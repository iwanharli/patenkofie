package service

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	repo *Repository
}

func NewHandler(repo *Repository) *Handler {
	return &Handler{repo: repo}
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

func serviceResponse(item Service) map[string]any {
	updatedBy := "-"
	if item.UpdatedByName != nil && *item.UpdatedByName != "" {
		updatedBy = *item.UpdatedByName
	}

	return map[string]any{
		"id":           item.ID,
		"code":         item.Code,
		"name":         item.Name,
		"price_per_kg": item.PricePerKg,
		"is_active":    item.IsActive,
		"updated_by":   updatedBy,
		"updated_at":   item.UpdatedAt,
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
