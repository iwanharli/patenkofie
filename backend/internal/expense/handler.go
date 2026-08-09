package expense

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"paten-kopi/backend/internal/auth"
)

type Handler struct {
	repo         *Repository
	sessionStore *auth.SessionStore
}

func NewHandler(repo *Repository, sessionStore *auth.SessionStore) *Handler {
	return &Handler{
		repo:         repo,
		sessionStore: sessionStore,
	}
}

func (h *Handler) currentUserID(r *http.Request) (int64, bool) {
	cookie, err := r.Cookie(auth.SessionCookieName)
	if err != nil {
		return 0, false
	}
	session, ok := h.sessionStore.Get(cookie.Value)
	if !ok {
		return 0, false
	}
	return session.UserID, true
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.currentUserID(r)
	if !ok {
		http.Error(w, `{"error":{"message":"Unauthorized"}}`, http.StatusUnauthorized)
		return
	}

	var payload CreateExpensePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error":{"message":"Invalid JSON payload"}}`, http.StatusBadRequest)
		return
	}

	if payload.Amount <= 0 || payload.Category == "" || payload.Description == "" || payload.ExpenseDate == "" {
		http.Error(w, `{"error":{"message":"Invalid payload values"}}`, http.StatusBadRequest)
		return
	}

	item, err := h.repo.Create(r.Context(), payload, userID)
	if err != nil {
		http.Error(w, `{"error":{"message":"Failed to create expense"}}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{"data": item})
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.currentUserID(r)
	if !ok {
		http.Error(w, `{"error":{"message":"Unauthorized"}}`, http.StatusUnauthorized)
		return
	}

	isOwner, err := h.repo.IsOwner(r.Context(), userID)
	if err != nil {
		http.Error(w, `{"error":{"message":"Failed to verify role"}}`, http.StatusInternalServerError)
		return
	}
	if !isOwner {
		http.Error(w, `{"error":{"message":"Hanya OWNER yang dapat mengubah catatan kas kecil"}}`, http.StatusForbidden)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, `{"error":{"message":"Invalid ID"}}`, http.StatusBadRequest)
		return
	}

	var payload UpdateExpensePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error":{"message":"Invalid JSON payload"}}`, http.StatusBadRequest)
		return
	}

	if payload.Amount <= 0 || payload.Category == "" || payload.Description == "" || payload.ExpenseDate == "" {
		http.Error(w, `{"error":{"message":"Invalid payload values"}}`, http.StatusBadRequest)
		return
	}

	item, err := h.repo.Update(r.Context(), id, payload)
	if err != nil {
		if errors.Is(err, ErrExpenseNotFound) {
			http.Error(w, `{"error":{"message":"Expense not found"}}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":{"message":"Failed to update expense"}}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"data": item})
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.currentUserID(r)
	if !ok {
		http.Error(w, `{"error":{"message":"Unauthorized"}}`, http.StatusUnauthorized)
		return
	}

	isOwner, err := h.repo.IsOwner(r.Context(), userID)
	if err != nil {
		http.Error(w, `{"error":{"message":"Failed to verify role"}}`, http.StatusInternalServerError)
		return
	}
	if !isOwner {
		http.Error(w, `{"error":{"message":"Hanya OWNER yang dapat menghapus catatan kas kecil"}}`, http.StatusForbidden)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, `{"error":{"message":"Invalid ID"}}`, http.StatusBadRequest)
		return
	}

	if err := h.repo.Delete(r.Context(), id); err != nil {
		if errors.Is(err, ErrExpenseNotFound) {
			http.Error(w, `{"error":{"message":"Expense not found"}}`, http.StatusNotFound)
			return
		}
		http.Error(w, `{"error":{"message":"Failed to delete expense"}}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.currentUserID(r); !ok {
		http.Error(w, `{"error":{"message":"Unauthorized"}}`, http.StatusUnauthorized)
		return
	}

	startDateStr := r.URL.Query().Get("start_date")
	endDateStr := r.URL.Query().Get("end_date")

	var startDate, endDate time.Time
	if startDateStr != "" {
		startDate, _ = time.Parse("2006-01-02", startDateStr)
	} else {
		startDate = time.Now()
	}
	if endDateStr != "" {
		endDate, _ = time.Parse("2006-01-02", endDateStr)
	} else {
		endDate = startDate
	}

	page := parsePositiveInt(r.URL.Query().Get("page"), 1)
	pageSize := parsePositiveInt(r.URL.Query().Get("page_size"), 10)
	if pageSize > 100 {
		pageSize = 100
	}

	result, err := h.repo.List(r.Context(), startDate, endDate, pageSize, (page-1)*pageSize)
	if err != nil {
		http.Error(w, `{"error":{"message":"Failed to list expenses"}}`, http.StatusInternalServerError)
		return
	}

	items := result.Items
	if items == nil {
		items = []Expense{} // prevent null in json
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"data": items,
		"meta": map[string]any{
			"page":         page,
			"page_size":    pageSize,
			"total_items":  result.Total,
			"total_amount": result.TotalAmount,
		},
	})
}

func parsePositiveInt(value string, fallback int) int {
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}
