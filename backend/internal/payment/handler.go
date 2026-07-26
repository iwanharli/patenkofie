package payment

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

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
	if _, ok := handler.currentUserID(r); !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	page := parsePositiveInt(r.URL.Query().Get("page"), 1)
	pageSize := parsePositiveInt(r.URL.Query().Get("page_size"), 10)
	if pageSize > 100 {
		pageSize = 100
	}

	result, err := handler.repo.List(r.Context(), ListFilter{
		Limit:         pageSize,
		Offset:        (page - 1) * pageSize,
		OrderStatus:   normalizeFilterValue(r.URL.Query().Get("order_status")),
		PaymentStatus: normalizeFilterValue(r.URL.Query().Get("payment_status")),
		PaymentType:   normalizeFilterValue(r.URL.Query().Get("payment_type")),
		RowType:       normalizeFilterValue(r.URL.Query().Get("row_type")),
		Search:        strings.TrimSpace(r.URL.Query().Get("search")),
		SortBy:        strings.TrimSpace(r.URL.Query().Get("sort_by")),
		SortDirection: strings.TrimSpace(r.URL.Query().Get("sort_direction")),
	}, time.Now())
	if err != nil {
		log.Error().Err(err).Msg("payment list failed")
		writeError(w, http.StatusInternalServerError, "PAYMENT_LIST_FAILED", "Daftar pembayaran gagal dibaca")
		return
	}

	items := make([]map[string]any, 0, len(result.Items))
	for _, item := range result.Items {
		items = append(items, paymentResponse(item))
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"data": items,
		"meta": map[string]any{
			"page":        page,
			"page_size":   pageSize,
			"total_items": result.Total,
		},
		"summary": summaryResponse(result.Summary),
	})
}

func (handler *Handler) Detail(w http.ResponseWriter, r *http.Request) {
	if _, ok := handler.currentUserID(r); !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	item, err := handler.repo.FindByCode(r.Context(), chi.URLParam(r, "code"))
	if errors.Is(err, ErrPaymentNotFound) {
		writeError(w, http.StatusNotFound, "PAYMENT_NOT_FOUND", "Pembayaran tidak ditemukan")
		return
	}
	if err != nil {
		log.Error().Err(err).Str("payment_code", chi.URLParam(r, "code")).Msg("payment detail failed")
		writeError(w, http.StatusInternalServerError, "PAYMENT_DETAIL_FAILED", "Pembayaran gagal dibaca")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"data": paymentResponse(item)})
}

func (handler *Handler) SettleOrder(w http.ResponseWriter, r *http.Request) {
	userID, ok := handler.currentUserID(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	var request struct {
		Notes string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request pembayaran tidak valid")
		return
	}

	item, err := handler.repo.SettleOrder(r.Context(), chi.URLParam(r, "code"), SettleOrderInput{
		ActorID: userID,
		Notes:   optionalString(request.Notes),
	})
	if errors.Is(err, ErrOrderNotFound) {
		writeError(w, http.StatusNotFound, "ORDER_NOT_FOUND", "Transaksi tidak ditemukan")
		return
	}
	if errors.Is(err, ErrOrderAlreadyPaid) {
		writeError(w, http.StatusBadRequest, "ORDER_ALREADY_PAID", "Transaksi sudah lunas")
		return
	}
	if err != nil {
		log.Error().Err(err).Str("order_code", chi.URLParam(r, "code")).Msg("settle payment failed")
		writeError(w, http.StatusInternalServerError, "SETTLE_PAYMENT_FAILED", "Pelunasan gagal disimpan")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"data": paymentResponse(item)})
}

func (handler *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := handler.currentUserID(r)
	if !ok || userID == 0 {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	isOwner, err := handler.repo.IsOwner(r.Context(), userID)
	if err != nil {
		log.Error().Err(err).Msg("delete payment role check failed")
		writeError(w, http.StatusInternalServerError, "ROLE_CHECK_FAILED", "Role pengguna gagal diperiksa")
		return
	}
	if !isOwner {
		writeError(w, http.StatusForbidden, "OWNER_ONLY", "Hanya OWNER yang dapat membatalkan/menghapus pembayaran")
		return
	}

	code := chi.URLParam(r, "code")
	item, err := handler.repo.VoidPayment(r.Context(), code, userID)
	if errors.Is(err, ErrPaymentNotFound) {
		writeError(w, http.StatusNotFound, "PAYMENT_NOT_FOUND", "Pembayaran tidak ditemukan")
		return
	}
	if err != nil {
		log.Error().Err(err).Str("payment_code", code).Msg("void payment failed")
		writeError(w, http.StatusInternalServerError, "VOID_PAYMENT_FAILED", "Pembayaran gagal dibatalkan")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"data": paymentResponse(item)})
}

func (handler *Handler) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := handler.currentUserID(r)
	if !ok || userID == 0 {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	isOwner, err := handler.repo.IsOwner(r.Context(), userID)
	if err != nil {
		log.Error().Err(err).Msg("update payment role check failed")
		writeError(w, http.StatusInternalServerError, "ROLE_CHECK_FAILED", "Role pengguna gagal diperiksa")
		return
	}
	if !isOwner {
		writeError(w, http.StatusForbidden, "OWNER_ONLY", "Hanya OWNER yang dapat mengoreksi pembayaran")
		return
	}

	code := chi.URLParam(r, "code")

	var request struct {
		Amount int64  `json:"amount"`
		Notes  string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request tidak valid")
		return
	}

	if request.Amount <= 0 {
		writeError(w, http.StatusBadRequest, "AMOUNT_REQUIRED", "Nominal pembayaran wajib lebih besar dari 0")
		return
	}

	item, err := handler.repo.UpdatePayment(r.Context(), code, UpdatePaymentInput{
		ActorID: userID,
		Amount:  request.Amount,
		Notes:   optionalString(request.Notes),
	})
	if errors.Is(err, ErrPaymentNotFound) {
		writeError(w, http.StatusNotFound, "PAYMENT_NOT_FOUND", "Pembayaran tidak ditemukan")
		return
	}
	if err != nil {
		log.Error().Err(err).Str("payment_code", code).Msg("update payment failed")
		writeError(w, http.StatusInternalServerError, "UPDATE_PAYMENT_FAILED", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"data": paymentResponse(item)})
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

func paymentResponse(item Payment) map[string]any {
	rowType := item.RowType
	if rowType == "" {
		rowType = "PAYMENT"
	}

	var paymentCode any = PaymentCode(item.ID)
	var paymentMethod any = item.PaymentMethod
	var receivedBy any = item.ReceivedBy
	var receivedByName any = item.ReceivedByName
	if rowType == "UNPAID_ORDER" {
		paymentCode = nil
		paymentMethod = nil
		receivedBy = nil
		receivedByName = nil
	}

	return map[string]any{
		"row_type":             rowType,
		"id":                   item.ID,
		"payment_code":         paymentCode,
		"order_id":             item.OrderID,
		"order_code":           item.OrderCode,
		"customer_name":        item.CustomerName,
		"payment_type":         item.PaymentType,
		"amount":               item.Amount,
		"payment_method":       paymentMethod,
		"received_by":          receivedBy,
		"received_by_name":     receivedByName,
		"paid_at":              item.PaidAt,
		"notes":                item.Notes,
		"order_total":          item.OrderTotal,
		"order_paid":           item.OrderPaid,
		"order_remaining":      item.OrderRemaining,
		"order_payment_status": item.OrderPayStatus,
		"order_status":         item.OrderStatus,
	}
}

func summaryResponse(item Summary) map[string]any {
	return map[string]any{
		"cash_today":        item.CashToday,
		"payments_today":    item.PaymentsToday,
		"outstanding_total": item.OutstandingTotal,
		"outstanding_count": item.OutstandingCount,
		"total_payments":    item.TotalPayments,
	}
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

func optionalString(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}

	return &trimmed
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
