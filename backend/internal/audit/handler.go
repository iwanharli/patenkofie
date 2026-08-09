package audit

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
	repo *Repository
}

func NewHandler(repo *Repository) *Handler {
	return &Handler{repo: repo}
}

func (handler *Handler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := handler.currentUserID(r)
	if !ok || userID == 0 {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	page := parsePositiveInt(r.URL.Query().Get("page"), 1)
	pageSize := parsePositiveInt(r.URL.Query().Get("page_size"), 15)
	if pageSize > 100 {
		pageSize = 100
	}

	result, err := handler.repo.List(r.Context(), AuditLogFilter{
		Action:   strings.TrimSpace(r.URL.Query().Get("action")),
		Entity:   strings.TrimSpace(r.URL.Query().Get("entity")),
		EntityID: strings.TrimSpace(r.URL.Query().Get("entity_id")),
		Limit:    pageSize,
		Offset:   (page - 1) * pageSize,
		Search:   strings.TrimSpace(r.URL.Query().Get("search")),
	})
	if err != nil {
		log.Error().Err(err).Msg("audit log list failed")
		writeError(w, http.StatusInternalServerError, "AUDIT_LOG_LIST_FAILED", "Data audit log gagal dibaca")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"data": result.Items,
		"meta": map[string]any{
			"page":        page,
			"page_size":   pageSize,
			"total_items": result.Total,
		},
	})
}

func (handler *Handler) Detail(w http.ResponseWriter, r *http.Request) {
	userID, ok := handler.currentUserID(r)
	if !ok || userID == 0 {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "INVALID_ID", "ID audit log tidak valid")
		return
	}

	item, err := handler.repo.FindByID(r.Context(), id)
	if errors.Is(err, ErrAuditLogNotFound) {
		writeError(w, http.StatusNotFound, "AUDIT_LOG_NOT_FOUND", "Audit log tidak ditemukan")
		return
	}
	if err != nil {
		log.Error().Err(err).Int64("audit_id", id).Msg("find audit log detail failed")
		writeError(w, http.StatusInternalServerError, "AUDIT_LOG_DETAIL_FAILED", "Audit log gagal dibaca")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"data": item})
}

func (handler *Handler) currentUserID(r *http.Request) (int64, bool) {
	actor, ok := auth.ActorFrom(r.Context())
	if !ok {
		return 0, false
	}

	return actor.UserID, true
}

func parsePositiveInt(value string, fallback int) int {
	parsed, err := strconv.Atoi(value)
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
