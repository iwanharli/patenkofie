package customer

import (
	"encoding/json"
	"errors"
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

func (handler *Handler) Suggestions(w http.ResponseWriter, r *http.Request) {
	if !handler.isAuthenticated(r) {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	limit := parsePositiveInt(r.URL.Query().Get("limit"), 8)
	items, err := handler.repo.Suggestions(r.Context(), r.URL.Query().Get("search"), limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "CUSTOMER_SUGGESTIONS_FAILED", "Saran pelanggan gagal dibaca")
		return
	}

	response := make([]map[string]any, 0, len(items))
	for _, item := range items {
		response = append(response, customerSuggestionResponse(item))
	}

	writeJSON(w, http.StatusOK, map[string]any{"data": response})
}

func (handler *Handler) List(w http.ResponseWriter, r *http.Request) {
	if !handler.isAuthenticated(r) {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	page := parsePositiveInt(r.URL.Query().Get("page"), 1)
	pageSize := parsePositiveInt(r.URL.Query().Get("page_size"), 12)
	if pageSize > 100 {
		pageSize = 100
	}

	result, err := handler.repo.List(r.Context(), CustomerListFilter{
		Limit:  pageSize,
		Offset: (page - 1) * pageSize,
		Search: strings.TrimSpace(r.URL.Query().Get("search")),
	})
	if err != nil {
		log.Error().Err(err).Msg("customer list failed")
		writeError(w, http.StatusInternalServerError, "CUSTOMER_LIST_FAILED", "Daftar pelanggan gagal dibaca")
		return
	}

	items := make([]map[string]any, 0, len(result.Items))
	for _, item := range result.Items {
		items = append(items, customerResponse(item))
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

func (handler *Handler) Detail(w http.ResponseWriter, r *http.Request) {
	if !handler.isAuthenticated(r) {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	customerID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || customerID <= 0 {
		writeError(w, http.StatusBadRequest, "INVALID_CUSTOMER_ID", "ID pelanggan tidak valid")
		return
	}

	item, err := handler.repo.FindByID(r.Context(), customerID)
	if errors.Is(err, ErrCustomerNotFound) {
		writeError(w, http.StatusNotFound, "CUSTOMER_NOT_FOUND", "Pelanggan tidak ditemukan")
		return
	}
	if err != nil {
		log.Error().Err(err).Int64("customer_id", customerID).Msg("customer detail failed")
		writeError(w, http.StatusInternalServerError, "CUSTOMER_DETAIL_FAILED", "Detail pelanggan gagal dibaca")
		return
	}

	ordersPage := parsePositiveInt(r.URL.Query().Get("orders_page"), 1)
	ordersPageSize := parsePositiveInt(r.URL.Query().Get("orders_page_size"), 10)
	if ordersPageSize > 50 {
		ordersPageSize = 50
	}

	orders, ordersTotal, err := handler.repo.OrdersByCustomerID(
		r.Context(), customerID, ordersPageSize, (ordersPage-1)*ordersPageSize,
	)
	if err != nil {
		log.Error().Err(err).Int64("customer_id", customerID).Msg("customer orders failed")
		writeError(w, http.StatusInternalServerError, "CUSTOMER_ORDERS_FAILED", "Riwayat order pelanggan gagal dibaca")
		return
	}

	orderItems := make([]map[string]any, 0, len(orders))
	for _, order := range orders {
		remaining := order.TotalAmount - order.PaidAmount
		if remaining < 0 {
			remaining = 0
		}
		orderItems = append(orderItems, map[string]any{
			"id":             order.ID,
			"order_code":     order.OrderCode,
			"service_code":   order.ServiceCode,
			"service_name":   order.ServiceName,
			"weight_kg":      order.WeightKg,
			"total_amount":   order.TotalAmount,
			"paid_amount":    order.PaidAmount,
			"remaining":      remaining,
			"payment_status": order.PaymentStatus,
			"order_status":   order.OrderStatus,
			"created_at":     order.CreatedAt,
		})
	}

	response := customerResponse(item)
	response["orders"] = orderItems
	response["orders_meta"] = map[string]any{
		"page":        ordersPage,
		"page_size":   ordersPageSize,
		"total_items": ordersTotal,
	}

	writeJSON(w, http.StatusOK, map[string]any{"data": response})
}

func (handler *Handler) Update(w http.ResponseWriter, r *http.Request) {
	if !handler.isAuthenticated(r) {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	customerID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || customerID <= 0 {
		writeError(w, http.StatusBadRequest, "INVALID_CUSTOMER_ID", "ID pelanggan tidak valid")
		return
	}

	var request struct {
		Name    string `json:"name"`
		Phone   string `json:"phone"`
		Address string `json:"address"`
		Notes   string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request tidak valid")
		return
	}

	name := strings.TrimSpace(request.Name)
	if name == "" {
		writeError(w, http.StatusBadRequest, "NAME_REQUIRED", "Nama pelanggan wajib diisi")
		return
	}

	item, err := handler.repo.Update(r.Context(), customerID, UpdateCustomerInput{
		Name:    name,
		Phone:   optionalString(request.Phone),
		Address: optionalString(request.Address),
		Notes:   optionalString(request.Notes),
	})
	if errors.Is(err, ErrCustomerNotFound) {
		writeError(w, http.StatusNotFound, "CUSTOMER_NOT_FOUND", "Pelanggan tidak ditemukan")
		return
	}
	if err != nil {
		log.Error().Err(err).Int64("customer_id", customerID).Msg("update customer failed")
		writeError(w, http.StatusInternalServerError, "UPDATE_CUSTOMER_FAILED", "Pelanggan gagal diperbarui")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"data": customerResponse(item)})
}

func (handler *Handler) isAuthenticated(r *http.Request) bool {
	actor, ok := auth.ActorFrom(r.Context())
	return ok && actor.UserID != 0
}

func customerSuggestionResponse(item CustomerSuggestion) map[string]any {
	return map[string]any{
		"id":              item.ID,
		"name":            item.Name,
		"phone":           item.Phone,
		"address":         item.Address,
		"notes":           item.Notes,
		"total_orders":    item.TotalOrders,
		"total_weight_kg": item.TotalWeightKg,
		"last_order_at":   item.LastOrderAt,
		"created_at":      item.CreatedAt,
	}
}

func customerResponse(item Customer) map[string]any {
	return map[string]any{
		"id":              item.ID,
		"name":            item.Name,
		"phone":           item.Phone,
		"address":         item.Address,
		"notes":           item.Notes,
		"total_orders":    item.TotalOrders,
		"total_weight_kg": item.TotalWeightKg,
		"total_spent":     item.TotalSpent,
		"receivable":      item.Receivable,
		"last_order_at":   item.LastOrderAt,
		"created_at":      item.CreatedAt,
	}
}

func parsePositiveInt(value string, fallback int) int {
	parsed, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || parsed <= 0 {
		return fallback
	}

	return parsed
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

func optionalString(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}

	return &trimmed
}

