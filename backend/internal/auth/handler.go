package auth

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

const SessionCookieName = "patenandum_session"

type Handler struct {
	repo         *Repository
	sessionStore *SessionStore
}

func NewHandler(repo *Repository, sessionStore *SessionStore) *Handler {
	return &Handler{repo: repo, sessionStore: sessionStore}
}

func (handler *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request login tidak valid")
		return
	}

	username := strings.TrimSpace(request.Username)
	if username == "" || request.Password == "" {
		writeError(w, http.StatusBadRequest, "LOGIN_REQUIRED", "Username dan password wajib diisi")
		return
	}

	user, err := handler.repo.FindActiveUserByUsername(r.Context(), username)
	if errors.Is(err, ErrUserNotFound) {
		writeError(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "Username atau password salah")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "LOGIN_FAILED", "Login gagal")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(request.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "Username atau password salah")
		return
	}

	session, err := handler.sessionStore.Create(user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "SESSION_FAILED", "Session gagal dibuat")
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    session.Token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   r.TLS != nil,
		Expires:  session.ExpiresAt,
		MaxAge:   int(time.Until(session.ExpiresAt).Seconds()),
	})

	writeJSON(w, http.StatusOK, map[string]any{
		"data": map[string]any{
			"user": userResponse(user),
		},
	})
}

func (handler *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(SessionCookieName)
	if err == nil {
		handler.sessionStore.Delete(cookie.Value)
	}

	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   r.TLS != nil,
		MaxAge:   -1,
	})

	writeJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"status": "logged_out"}})
}

func (handler *Handler) Me(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(SessionCookieName)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak ditemukan")
		return
	}

	session, ok := handler.sessionStore.Get(cookie.Value)
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	user, err := handler.repo.FindActiveUserByID(r.Context(), session.UserID)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "User tidak ditemukan")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"data": map[string]any{
			"user": userResponse(user),
		},
	})
}

func userResponse(user User) map[string]any {
	return map[string]any{
		"id":       user.ID,
		"name":     user.Name,
		"username": user.Username,
		"role":     user.Role,
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
