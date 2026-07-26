package user

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"

	"paten-kopi/backend/internal/auth"
)

type Handler struct {
	repo           *Repository
	sessionStore   *auth.SessionStore
	uploadDir      string
	maxUploadBytes int64
}

func NewHandler(repo *Repository, sessionStore *auth.SessionStore, uploadDir string, maxUploadBytes int64) *Handler {
	return &Handler{
		repo:           repo,
		sessionStore:   sessionStore,
		uploadDir:      uploadDir,
		maxUploadBytes: maxUploadBytes,
	}
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

	result, err := handler.repo.List(r.Context(), pageSize, (page-1)*pageSize)
	if err != nil {
		log.Error().Err(err).Msg("user list failed")
		writeError(w, http.StatusInternalServerError, "USER_LIST_FAILED", "Daftar pengguna gagal dibaca")
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
	if _, ok := handler.currentUserID(r); !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	username := chi.URLParam(r, "username")
	u, err := handler.repo.FindByUsername(r.Context(), username)
	if errors.Is(err, ErrUserNotFound) {
		writeError(w, http.StatusNotFound, "USER_NOT_FOUND", "Pengguna tidak ditemukan")
		return
	}
	if err != nil {
		log.Error().Err(err).Str("username", username).Msg("user detail failed")
		writeError(w, http.StatusInternalServerError, "USER_DETAIL_FAILED", "Detail pengguna gagal dibaca")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"data": u})
}

func (handler *Handler) Create(w http.ResponseWriter, r *http.Request) {
	currentUserID, ok := handler.currentUserID(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	currentUser, err := handler.repo.FindByID(r.Context(), currentUserID)
	if err != nil || currentUser.Role != "OWNER" {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "Hanya OWNER yang dapat membuat pengguna baru")
		return
	}

	var request struct {
		Name     string `json:"name"`
		Username string `json:"username"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request tidak valid")
		return
	}

	name := strings.TrimSpace(request.Name)
	username := strings.TrimSpace(request.Username)
	password := request.Password
	role := strings.ToUpper(strings.TrimSpace(request.Role))

	if name == "" {
		writeError(w, http.StatusBadRequest, "NAME_REQUIRED", "Nama pengguna wajib diisi")
		return
	}
	if username == "" {
		writeError(w, http.StatusBadRequest, "USERNAME_REQUIRED", "Username wajib diisi")
		return
	}
	if len(password) < 6 {
		writeError(w, http.StatusBadRequest, "PASSWORD_TOO_SHORT", "Password minimal 6 karakter")
		return
	}
	if role != "OWNER" && role != "STAFF" {
		role = "STAFF"
	}

	u, err := handler.repo.Create(r.Context(), CreateUserInput{
		Name:     name,
		Username: username,
		Password: password,
		Role:     role,
	})
	if errors.Is(err, ErrUsernameDuplicate) {
		writeError(w, http.StatusBadRequest, "USERNAME_DUPLICATE", "Username sudah digunakan")
		return
	}
	if err != nil {
		log.Error().Err(err).Msg("create user failed")
		writeError(w, http.StatusInternalServerError, "CREATE_USER_FAILED", "Pengguna gagal dibuat")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"data": u})

	_ = handler.repo.InsertAuditLog(r.Context(), currentUserID, "CREATE_USER", "users", u.Username, "{}")
}

func (handler *Handler) Update(w http.ResponseWriter, r *http.Request) {
	currentUserID, ok := handler.currentUserID(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	currentUser, err := handler.repo.FindByID(r.Context(), currentUserID)
	if err != nil || currentUser.Role != "OWNER" {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "Hanya OWNER yang dapat mengubah data pengguna")
		return
	}

	usernameParam := chi.URLParam(r, "username")

	var request struct {
		Name     string `json:"name"`
		Role     string `json:"role"`
		IsActive bool   `json:"is_active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request tidak valid")
		return
	}

	name := strings.TrimSpace(request.Name)
	role := strings.ToUpper(strings.TrimSpace(request.Role))

	if name == "" {
		writeError(w, http.StatusBadRequest, "NAME_REQUIRED", "Nama pengguna wajib diisi")
		return
	}
	if role != "OWNER" && role != "STAFF" {
		role = "STAFF"
	}

	u, err := handler.repo.Update(r.Context(), usernameParam, UpdateUserInput{
		IsActive: request.IsActive,
		Name:     name,
		Role:     role,
	})
	if errors.Is(err, ErrUserNotFound) {
		writeError(w, http.StatusNotFound, "USER_NOT_FOUND", "Pengguna tidak ditemukan")
		return
	}
	if err != nil {
		log.Error().Err(err).Str("username", usernameParam).Msg("update user failed")
		writeError(w, http.StatusInternalServerError, "UPDATE_USER_FAILED", "Data pengguna gagal diperbarui")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"data": u})

	_ = handler.repo.InsertAuditLog(r.Context(), currentUserID, "UPDATE_USER", "users", u.Username, "{}")
}

func (handler *Handler) UpdatePreferences(w http.ResponseWriter, r *http.Request) {
	currentUserID, ok := handler.currentUserID(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	username := r.PathValue("username")
	if username == "" {
		writeError(w, http.StatusBadRequest, "USERNAME_REQUIRED", "Username tidak valid")
		return
	}

	targetUser, err := handler.repo.FindByUsername(r.Context(), username)
	if err != nil {
		writeError(w, http.StatusNotFound, "USER_NOT_FOUND", "Pengguna tidak ditemukan")
		return
	}

	if targetUser.ID != currentUserID {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "Anda tidak memiliki akses")
		return
	}

	var prefs map[string]any
	if err := json.NewDecoder(r.Body).Decode(&prefs); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Format data tidak valid")
		return
	}

	if err := handler.repo.UpdateNotificationPreferences(r.Context(), username, prefs); err != nil {
		log.Error().Err(err).Msg("failed to update preferences")
		writeError(w, http.StatusInternalServerError, "UPDATE_FAILED", "Gagal memperbarui preferensi")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"status": "success"}})
}

func (handler *Handler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	currentUserID, ok := handler.currentUserID(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	currentUser, err := handler.repo.FindByID(r.Context(), currentUserID)
	if err != nil || currentUser.Role != "OWNER" {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "Hanya OWNER yang dapat mereset password pengguna")
		return
	}

	usernameParam := chi.URLParam(r, "username")

	var request struct {
		NewPassword string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request tidak valid")
		return
	}

	if len(request.NewPassword) < 6 {
		writeError(w, http.StatusBadRequest, "PASSWORD_TOO_SHORT", "Password baru minimal 6 karakter")
		return
	}

	err = handler.repo.ResetPassword(r.Context(), usernameParam, request.NewPassword)
	if errors.Is(err, ErrUserNotFound) {
		writeError(w, http.StatusNotFound, "USER_NOT_FOUND", "Pengguna tidak ditemukan")
		return
	}
	if err != nil {
		log.Error().Err(err).Str("username", usernameParam).Msg("reset password failed")
		writeError(w, http.StatusInternalServerError, "RESET_PASSWORD_FAILED", "Password gagal direset")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"message": "Password berhasil direset"}})

	_ = handler.repo.InsertAuditLog(r.Context(), currentUserID, "RESET_PASSWORD", "users", usernameParam, "{}")
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

func parsePositiveInt(value string, fallback int) int {
	parsed, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || parsed <= 0 {
		return fallback
	}

	return parsed
}

func (handler *Handler) UploadAvatar(w http.ResponseWriter, r *http.Request) {
	currentUserID, ok := handler.currentUserID(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	targetUsername := chi.URLParam(r, "username")
	currentUser, err := handler.repo.FindByID(r.Context(), currentUserID)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Pengguna tidak ditemukan")
		return
	}

	if currentUser.Role != "OWNER" && !strings.EqualFold(currentUser.Username, targetUsername) {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "Anda tidak memiliki izin mengubah foto profil ini")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, handler.maxUploadBytes+(1<<20))
	if err := r.ParseMultipartForm(handler.maxUploadBytes); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_UPLOAD", "Foto profil terlalu besar")
		return
	}

	file, header, err := r.FormFile("avatar")
	if err != nil {
		writeError(w, http.StatusBadRequest, "FILE_REQUIRED", "Foto profil wajib diunggah")
		return
	}
	defer file.Close()

	if header.Size > handler.maxUploadBytes {
		writeError(w, http.StatusBadRequest, "FILE_TOO_LARGE", "Ukuran foto melebihi batas upload")
		return
	}

	buffer := make([]byte, 512)
	readBytes, readErr := io.ReadFull(file, buffer)
	if readErr != nil && !errors.Is(readErr, io.ErrUnexpectedEOF) {
		writeError(w, http.StatusInternalServerError, "FILE_READ_FAILED", "Foto gagal dibaca")
		return
	}

	if !strings.HasPrefix(http.DetectContentType(buffer[:readBytes]), "image/") {
		writeError(w, http.StatusBadRequest, "INVALID_FILE_TYPE", "Format file harus berupa gambar")
		return
	}

	decodedImage, _, err := image.Decode(io.MultiReader(bytes.NewReader(buffer[:readBytes]), file))
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_IMAGE", "Foto gagal diproses")
		return
	}

	filename := fmt.Sprintf("avatar-%s-%d-%s.jpg", targetUsername, time.Now().Unix(), randomToken())
	relativePath := filepath.Join("users", filename)
	targetPath := filepath.Join(handler.uploadDir, relativePath)

	if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
		writeError(w, http.StatusInternalServerError, "UPLOAD_FAILED", "Folder upload gagal dibuat")
		return
	}

	target, err := os.Create(targetPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "UPLOAD_FAILED", "File foto gagal dibuat")
		return
	}
	defer target.Close()

	if err := jpeg.Encode(target, decodedImage, &jpeg.Options{Quality: 85}); err != nil {
		writeError(w, http.StatusInternalServerError, "UPLOAD_FAILED", "Foto gagal disimpan")
		return
	}

	avatarUrl := "/uploads/" + filepath.ToSlash(relativePath)
	if err := handler.repo.UpdateAvatar(r.Context(), targetUsername, avatarUrl); err != nil {
		os.Remove(targetPath)
		writeError(w, http.StatusInternalServerError, "UPDATE_AVATAR_FAILED", "Gagal memperbarui database")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"data": map[string]string{
			"avatar_url": avatarUrl,
			"message":    "Foto profil berhasil diperbarui",
		},
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

func randomToken() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}
