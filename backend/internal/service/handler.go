package service

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

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
	services, err := handler.repo.List(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "SERVICES_LIST_FAILED", "Data layanan gagal dibaca")
		return
	}

	response := make([]map[string]any, 0, len(services))
	for _, item := range services {
		response = append(response, serviceResponse(item))
	}

	writeJSON(w, http.StatusOK, map[string]any{"data": response})
}

func (handler *Handler) Detail(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	item, err := handler.repo.FindByCode(r.Context(), code)
	if errors.Is(err, ErrServiceNotFound) {
		writeError(w, http.StatusNotFound, "SERVICE_NOT_FOUND", "Layanan tidak ditemukan")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "SERVICE_DETAIL_FAILED", "Data layanan gagal dibaca")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"data": serviceResponse(item)})
}

func (handler *Handler) Update(w http.ResponseWriter, r *http.Request) {
	actor, ok := auth.ActorFrom(r.Context())
	if !ok || actor.UserID == 0 {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	code := chi.URLParam(r, "code")
	var req struct {
		PricePerKg *int64 `json:"price_per_kg"`
		IsActive   *bool  `json:"is_active"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request tidak valid")
		return
	}

	item, err := handler.repo.FindByCode(r.Context(), code)
	if errors.Is(err, ErrServiceNotFound) {
		writeError(w, http.StatusNotFound, "SERVICE_NOT_FOUND", "Layanan tidak ditemukan")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "SERVICE_DETAIL_FAILED", "Data layanan gagal dibaca")
		return
	}

	pricePerKg := item.PricePerKg
	if req.PricePerKg != nil {
		pricePerKg = *req.PricePerKg
	}

	isActive := item.IsActive
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	if err := handler.repo.Update(r.Context(), code, pricePerKg, isActive, actor.UserID); err != nil {
		writeError(w, http.StatusInternalServerError, "SERVICE_UPDATE_FAILED", "Data layanan gagal diperbarui")
		return
	}

	// Fetch updated item
	updatedItem, _ := handler.repo.FindByCode(r.Context(), code)

	writeJSON(w, http.StatusOK, map[string]any{"data": serviceResponse(updatedItem)})
}

func serviceResponse(item Service) map[string]any {
	updatedBy := "-"
	if item.UpdatedByName != nil && *item.UpdatedByName != "" {
		updatedBy = *item.UpdatedByName
	}

	return map[string]any{
		"id":            item.ID,
		"code":          item.Code,
		"name":          item.Name,
		"price_per_kg":  item.PricePerKg,
		"is_active":     item.IsActive,
		"updated_by":    updatedBy,
		"updated_at":    item.UpdatedAt,
		"today_orders":  item.TodayOrders,
		"today_weight":  item.TodayWeight,
		"today_revenue": item.TodayRevenue,
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
