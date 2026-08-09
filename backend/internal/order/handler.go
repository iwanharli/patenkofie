package order

import (
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"

	"paten-kopi/backend/internal/auth"
)

type Handler struct {
	repo         *Repository
	sessionStore *auth.SessionStore
}

func NewHandler(repo *Repository, sessionStore *auth.SessionStore) *Handler {
	return &Handler{repo: repo, sessionStore: sessionStore}
}

func (handler *Handler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := handler.currentUserID(r)
	if !ok || userID == 0 {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	page := parsePositiveInt(r.URL.Query().Get("page"), 1)
	pageSize := parsePositiveInt(r.URL.Query().Get("page_size"), 10)
	if pageSize > 100 {
		pageSize = 100
	}

	filter := ListOrdersFilter{
		Limit:         pageSize,
		Offset:        (page - 1) * pageSize,
		OrderStatus:   normalizeFilterValue(r.URL.Query().Get("order_status")),
		PaymentStatus: normalizeFilterValue(r.URL.Query().Get("payment_status")),
		Search:        strings.TrimSpace(r.URL.Query().Get("search")),
		ServiceCode:   normalizeFilterValue(r.URL.Query().Get("service_code")),
		SortBy:        strings.TrimSpace(r.URL.Query().Get("sort_by")),
		SortDirection: strings.TrimSpace(r.URL.Query().Get("sort_direction")),
	}

	result, err := handler.repo.List(r.Context(), filter)
	if err != nil {
		log.Error().Err(err).Msg("order list failed")
		writeError(w, http.StatusInternalServerError, "ORDER_LIST_FAILED", "Daftar transaksi gagal dibaca")
		return
	}

	items := make([]map[string]any, 0, len(result.Items))
	for _, item := range result.Items {
		items = append(items, orderResponse(item))
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"data": items,
		"meta": map[string]any{
			"page":        page,
			"page_size":   pageSize,
			"total_items": result.Total,
		},
	})
}

func (handler *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := handler.currentUserID(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	var request struct {
		CustomerName  string  `json:"customer_name"`
		CustomerPhone string  `json:"customer_phone"`
		ServiceCode   string  `json:"service_code"`
		WeightValue   float64 `json:"weight_value"`
		WeightUnit    string  `json:"weight_unit"`
		RoastLevel    string  `json:"roast_level"`
		GrindLevel    string  `json:"grind_level"`
		Notes         string  `json:"notes"`
		PaymentType   string  `json:"payment_type"`
		PaidAmount    int64   `json:"paid_amount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request transaksi tidak valid")
		return
	}

	input, validationMessage := buildCreateInput(request, userID)
	if validationMessage != "" {
		writeError(w, http.StatusBadRequest, "INVALID_ORDER", validationMessage)
		return
	}

	item, err := handler.repo.Create(r.Context(), input)
	if err != nil {
		log.Error().Err(err).Msg("create order failed")
		writeError(w, http.StatusInternalServerError, "CREATE_ORDER_FAILED", "Transaksi gagal dibuat")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"data": orderResponse(item)})
}

func (handler *Handler) Detail(w http.ResponseWriter, r *http.Request) {
	userID, ok := handler.currentUserID(r)
	if !ok || userID == 0 {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	item, err := handler.repo.FindByCode(r.Context(), chi.URLParam(r, "code"))
	if errors.Is(err, ErrOrderNotFound) {
		writeError(w, http.StatusNotFound, "ORDER_NOT_FOUND", "Transaksi tidak ditemukan")
		return
	}
	if err != nil {
		log.Error().Err(err).Str("order_code", chi.URLParam(r, "code")).Msg("order detail failed")
		writeError(w, http.StatusInternalServerError, "ORDER_DETAIL_FAILED", "Transaksi gagal dibaca")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"data": orderResponse(item)})
}

func (handler *Handler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	userID, ok := handler.currentUserID(r)
	if !ok || userID == 0 {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	var request struct {
		OrderStatus string `json:"order_status"`
		Notes       string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request update status tidak valid")
		return
	}

	nextStatus := strings.ToUpper(strings.TrimSpace(request.OrderStatus))
	if !isValidOrderStatus(nextStatus) {
		writeError(w, http.StatusBadRequest, "INVALID_ORDER_STATUS", "Status pesanan tidak valid")
		return
	}
	if nextStatus == "SELESAI" {
		writeError(w, http.StatusBadRequest, "PICKUP_PHOTO_REQUIRED", "Status selesai harus melalui serah terima dengan foto")
		return
	}

	item, err := handler.repo.UpdateStatus(r.Context(), chi.URLParam(r, "code"), UpdateOrderStatusInput{
		OrderStatus: nextStatus,
		Notes:       optionalString(request.Notes),
		ActorID:     userID,
	})
	if errors.Is(err, ErrOrderNotFound) {
		writeError(w, http.StatusNotFound, "ORDER_NOT_FOUND", "Transaksi tidak ditemukan")
		return
	}
	if err != nil {
		log.Error().Err(err).Str("order_code", chi.URLParam(r, "code")).Msg("update order status failed")
		writeError(w, http.StatusInternalServerError, "UPDATE_ORDER_STATUS_FAILED", "Status transaksi gagal diperbarui")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"data": orderResponse(item)})
}

func (handler *Handler) BulkUpdateStatus(w http.ResponseWriter, r *http.Request) {
	userID, ok := handler.currentUserID(r)
	if !ok || userID == 0 {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	var request struct {
		OrderCodes  []string `json:"order_codes"`
		OrderStatus string   `json:"order_status"`
		Notes       string   `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request bulk update status tidak valid")
		return
	}

	orderCodes := normalizeOrderCodes(request.OrderCodes)
	if len(orderCodes) == 0 {
		writeError(w, http.StatusBadRequest, "ORDER_CODES_REQUIRED", "Pilih minimal satu transaksi")
		return
	}
	if len(orderCodes) > 100 {
		writeError(w, http.StatusBadRequest, "TOO_MANY_ORDERS", "Maksimal 100 transaksi untuk sekali update")
		return
	}

	nextStatus := strings.ToUpper(strings.TrimSpace(request.OrderStatus))
	if !isValidBulkOrderStatus(nextStatus) {
		writeError(w, http.StatusBadRequest, "INVALID_BULK_ORDER_STATUS", "Bulk update hanya untuk Menunggu, Diproses, Siap diambil, atau Dibatalkan")
		return
	}

	result, err := handler.repo.BulkUpdateStatus(r.Context(), BulkUpdateOrderStatusInput{
		OrderCodes:  orderCodes,
		OrderStatus: nextStatus,
		Notes:       optionalString(request.Notes),
		ActorID:     userID,
	})
	if errors.Is(err, ErrBulkOrderStatusMismatch) {
		writeError(w, http.StatusBadRequest, "BULK_ORDER_STATUS_MISMATCH", "Bulk update hanya bisa untuk transaksi dengan status yang sama")
		return
	}
	if err != nil {
		log.Error().Err(err).Strs("order_codes", orderCodes).Msg("bulk update order status failed")
		writeError(w, http.StatusInternalServerError, "BULK_UPDATE_ORDER_STATUS_FAILED", "Status transaksi gagal diperbarui")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"data": map[string]any{
			"requested_count": result.RequestedCount,
			"updated_count":   result.UpdatedCount,
			"skipped_count":   result.SkippedCount,
			"not_found_count": result.NotFoundCount,
		},
	})
}

func (handler *Handler) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := handler.currentUserID(r)
	if !ok || userID == 0 {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	code := chi.URLParam(r, "code")

	var request struct {
		CustomerName  string  `json:"customer_name"`
		CustomerPhone *string `json:"customer_phone"`
		ServiceCode   string  `json:"service_code"`
		WeightGrams   int64   `json:"weight_grams"`
		RoastLevel    *string `json:"roast_level"`
		GrindLevel    *string `json:"grind_level"`
		Notes         string  `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request tidak valid")
		return
	}

	serviceCode := strings.TrimSpace(request.ServiceCode)
	if serviceCode == "" {
		writeError(w, http.StatusBadRequest, "SERVICE_CODE_REQUIRED", "Kode layanan wajib diisi")
		return
	}
	if request.WeightGrams <= 0 {
		writeError(w, http.StatusBadRequest, "WEIGHT_REQUIRED", "Berat wajib lebih besar dari 0 gram")
		return
	}

	if strings.TrimSpace(request.CustomerName) == "" {
		writeError(w, http.StatusBadRequest, "CUSTOMER_NAME_REQUIRED", "Nama pelanggan wajib diisi")
		return
	}

	item, err := handler.repo.UpdateOrder(r.Context(), code, UpdateOrderInput{
		ActorID:       userID,
		CustomerName:  strings.TrimSpace(request.CustomerName),
		CustomerPhone: request.CustomerPhone,
		Notes:         optionalString(request.Notes),
		ServiceCode:   serviceCode,
		WeightGrams:   request.WeightGrams,
		RoastLevel:    request.RoastLevel,
		GrindLevel:    request.GrindLevel,
	})
	if errors.Is(err, ErrOrderNotFound) {
		writeError(w, http.StatusNotFound, "ORDER_NOT_FOUND", "Transaksi tidak ditemukan")
		return
	}
	if errors.Is(err, ErrOrderNotEditable) {
		writeError(w, http.StatusBadRequest, "ORDER_NOT_EDITABLE", "Transaksi yang dapat diubah hanya yang berstatus Menunggu atau Diproses")
		return
	}
	if err != nil {
		log.Error().Err(err).Str("order_code", code).Msg("update order failed")
		writeError(w, http.StatusInternalServerError, "UPDATE_ORDER_FAILED", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"data": orderResponse(item)})
}

func (handler *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := handler.currentUserID(r)
	if !ok || userID == 0 {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	isOwner, err := handler.repo.IsOwner(r.Context(), userID)
	if err != nil {
		log.Error().Err(err).Msg("delete order role check failed")
		writeError(w, http.StatusInternalServerError, "ROLE_CHECK_FAILED", "Role pengguna gagal diperiksa")
		return
	}
	if !isOwner {
		writeError(w, http.StatusForbidden, "OWNER_ONLY", "Hanya owner yang dapat menghapus transaksi")
		return
	}

	item, err := handler.repo.DeleteByCode(r.Context(), chi.URLParam(r, "code"), userID)
	if errors.Is(err, ErrOrderNotFound) {
		writeError(w, http.StatusNotFound, "ORDER_NOT_FOUND", "Transaksi tidak ditemukan")
		return
	}
	if err != nil {
		log.Error().Err(err).Str("order_code", chi.URLParam(r, "code")).Msg("delete order failed")
		writeError(w, http.StatusInternalServerError, "DELETE_ORDER_FAILED", "Transaksi gagal dihapus")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"data": orderResponse(item)})
}

func (handler *Handler) currentUserID(r *http.Request) (int64, bool) {
	cookie, err := r.Cookie(auth.SessionCookieName)
	if err != nil {
		return 0, false
	}

	session, ok := handler.sessionStore.Get(cookie.Value)
	if !ok {
		return 0, false
	}

	return session.UserID, true
}

func buildCreateInput(request struct {
	CustomerName  string  `json:"customer_name"`
	CustomerPhone string  `json:"customer_phone"`
	ServiceCode   string  `json:"service_code"`
	WeightValue   float64 `json:"weight_value"`
	WeightUnit    string  `json:"weight_unit"`
	RoastLevel    string  `json:"roast_level"`
	GrindLevel    string  `json:"grind_level"`
	Notes         string  `json:"notes"`
	PaymentType   string  `json:"payment_type"`
	PaidAmount    int64   `json:"paid_amount"`
}, userID int64) (CreateOrderInput, string) {
	customerName := strings.TrimSpace(request.CustomerName)
	if customerName == "" {
		return CreateOrderInput{}, "Nama pelanggan wajib diisi"
	}

	serviceCode := strings.ToUpper(strings.TrimSpace(request.ServiceCode))
	if serviceCode != "G" && serviceCode != "R" && serviceCode != "GR" {
		return CreateOrderInput{}, "Layanan tidak valid"
	}

	weightGrams := toWeightGrams(request.WeightValue, request.WeightUnit)
	if weightGrams <= 0 {
		return CreateOrderInput{}, "Berat masuk wajib lebih dari 0"
	}

	paymentType := strings.ToUpper(strings.TrimSpace(request.PaymentType))
	if paymentType == "" {
		paymentType = "PAY_LATER"
	}
	if paymentType != "FULL_PAYMENT" && paymentType != "DOWN_PAYMENT" && paymentType != "PAY_LATER" {
		return CreateOrderInput{}, "Skema pembayaran tidak valid"
	}
	if request.PaidAmount < 0 {
		return CreateOrderInput{}, "Pembayaran awal tidak boleh negatif"
	}
	if paymentType == "PAY_LATER" {
		request.PaidAmount = 0
	}
	if paymentType == "DOWN_PAYMENT" && request.PaidAmount <= 0 {
		return CreateOrderInput{}, "Nominal DP wajib diisi"
	}

	return CreateOrderInput{
		CustomerName:  customerName,
		CustomerPhone: optionalString(request.CustomerPhone),
		ServiceCode:   serviceCode,
		WeightGrams:   weightGrams,
		RoastLevel:    optionalEnum(request.RoastLevel),
		GrindLevel:    optionalString(request.GrindLevel),
		Notes:         optionalString(request.Notes),
		PaymentType:   paymentType,
		PaidAmount:    request.PaidAmount,
		CreatedBy:     userID,
	}, ""
}

func toWeightGrams(value float64, unit string) int64 {
	if value <= 0 {
		return 0
	}

	switch strings.ToUpper(strings.TrimSpace(unit)) {
	case "GRAM", "G":
		return int64(math.Round(value))
	default:
		return int64(math.Round(value * 1000))
	}
}

func optionalString(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}

	return &trimmed
}

func optionalEnum(value string) *string {
	trimmed := strings.ToUpper(strings.TrimSpace(value))
	if trimmed == "" || trimmed == "NONE" {
		return nil
	}

	return &trimmed
}

func parsePositiveInt(value string, fallback int) int {
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return fallback
	}

	return parsed
}

func normalizeFilterValue(value string) string {
	normalized := strings.ToUpper(strings.TrimSpace(value))
	if normalized == "" || normalized == "ALL" {
		return ""
	}

	return normalized
}

func normalizeOrderCodes(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}

	return result
}

func isValidOrderStatus(value string) bool {
	switch value {
	case "MENUNGGU", "DIPROSES", "SIAP_DIAMBIL", "SELESAI", "DIBATALKAN":
		return true
	default:
		return false
	}
}

func isValidBulkOrderStatus(value string) bool {
	switch value {
	case "MENUNGGU", "DIPROSES", "SIAP_DIAMBIL", "DIBATALKAN":
		return true
	default:
		return false
	}
}

func orderResponse(item Order) map[string]any {
	remaining := item.TotalAmount - item.PaidAmount
	if remaining < 0 {
		remaining = 0
	}

	return map[string]any{
		"id":             item.ID,
		"order_code":     item.OrderCode,
		"customer_id":    item.CustomerID,
		"customer_name":  item.CustomerName,
		"customer_phone": item.CustomerPhone,
		"service_code":   item.ServiceCode,
		"service_name":   item.ServiceName,
		"weight_kg":      item.WeightKg,
		"price_per_kg":   item.PricePerKg,
		"total_amount":   item.TotalAmount,
		"paid_amount":    item.PaidAmount,
		"remaining":      remaining,
		"payment_status": item.PaymentStatus,
		"order_status":   item.OrderStatus,
		"roast_level":    item.RoastLevel,
		"grind_level":    item.GrindLevel,
		"notes":          item.Notes,
		"created_at":     item.CreatedAt,
		"updated_at":     item.UpdatedAt,
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, code string, message string) {
	writeJSON(w, status, map[string]any{
		"error": map[string]any{
			"code":    code,
			"message": message,
		},
	})
}
