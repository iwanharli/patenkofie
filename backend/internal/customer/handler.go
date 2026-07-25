package customer

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

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

func (handler *Handler) isAuthenticated(r *http.Request) bool {
	cookie, err := r.Cookie(auth.SessionCookieName)
	if err != nil {
		return false
	}

	session, ok := handler.sessionStore.Get(cookie.Value)
	return ok && session.UserID != 0
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
