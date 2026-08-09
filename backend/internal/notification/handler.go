package notification

import (
	"encoding/json"
	"net/http"

	"paten-kopi/backend/internal/auth"
)

type Handler struct {
	repo *Repository
}

func NewHandler(repo *Repository) *Handler {
	return &Handler{repo: repo}
}

func (handler *Handler) currentUserID(r *http.Request) (int64, bool) {
	actor, ok := auth.ActorFrom(r.Context())
	if !ok {
		return 0, false
	}

	return actor.UserID, true
}

func (handler *Handler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := handler.currentUserID(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	notifications, err := handler.repo.ListByUserID(r.Context(), userID, 50)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "NOTIFICATIONS_FETCH_FAILED", "Gagal mengambil notifikasi")
		return
	}

	if notifications == nil {
		notifications = []Notification{}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"data": notifications,
	})
}

func (handler *Handler) MarkAllAsRead(w http.ResponseWriter, r *http.Request) {
	userID, ok := handler.currentUserID(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	err := handler.repo.MarkAllAsRead(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "NOTIFICATIONS_UPDATE_FAILED", "Gagal memperbarui notifikasi")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"data": map[string]string{"status": "success"},
	})
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
