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
		Limit:  pageSize,
		Offset: (page - 1) * pageSize,
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
	return map[string]any{
		"id":                   item.ID,
		"payment_code":         PaymentCode(item.ID),
		"order_id":             item.OrderID,
		"order_code":           item.OrderCode,
		"customer_name":        item.CustomerName,
		"payment_type":         item.PaymentType,
		"amount":               item.Amount,
		"payment_method":       item.PaymentMethod,
		"received_by":          item.ReceivedBy,
		"received_by_name":     item.ReceivedByName,
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
