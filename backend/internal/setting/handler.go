package setting

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
	"strings"
	"time"

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

func (handler *Handler) GetProfile(w http.ResponseWriter, r *http.Request) {
	if _, ok := handler.currentUserID(r); !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	profile, err := handler.repo.GetBusinessProfile(r.Context())
	if err != nil {
		log.Error().Err(err).Msg("get business profile failed")
		writeError(w, http.StatusInternalServerError, "GET_PROFILE_FAILED", "Profil toko gagal dibaca")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"data": profile})
}

func (handler *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID, ok := handler.currentUserID(r)
	if !ok || userID == 0 {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	var request struct {
		BusinessName    string `json:"business_name"`
		BusinessAddress string `json:"business_address"`
		BusinessPhone   string `json:"business_phone"`
		ReceiptFooter   string `json:"receipt_footer"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "Request tidak valid")
		return
	}

	if strings.TrimSpace(request.BusinessName) == "" {
		writeError(w, http.StatusBadRequest, "BUSINESS_NAME_REQUIRED", "Nama toko wajib diisi")
		return
	}

	profile, err := handler.repo.UpdateBusinessProfile(r.Context(), UpdateBusinessProfileInput{
		ActorID:         userID,
		BusinessAddress: request.BusinessAddress,
		BusinessName:    request.BusinessName,
		BusinessPhone:   request.BusinessPhone,
		ReceiptFooter:   request.ReceiptFooter,
	})
	if err != nil {
		log.Error().Err(err).Msg("update business profile failed")
		writeError(w, http.StatusInternalServerError, "UPDATE_PROFILE_FAILED", "Profil toko gagal diperbarui")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"data": profile})
}

func (handler *Handler) DownloadBackup(w http.ResponseWriter, r *http.Request) {
	userID, ok := handler.currentUserID(r)
	if !ok || userID == 0 {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	backupData, filename, err := handler.repo.ExportBackup(r.Context())
	if err != nil {
		log.Error().Err(err).Msg("export backup failed")
		writeError(w, http.StatusInternalServerError, "EXPORT_BACKUP_FAILED", "Backup database gagal dihasilkan")
		return
	}

	w.Header().Set("Content-Type", "application/sql")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(backupData)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(backupData)
}

func (handler *Handler) currentUserID(r *http.Request) (int64, bool) {
	actor, ok := auth.ActorFrom(r.Context())
	if !ok {
		return 0, false
	}

	return actor.UserID, true
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

func (handler *Handler) UploadLogo(w http.ResponseWriter, r *http.Request) {
	userID, ok := handler.currentUserID(r)
	if !ok || userID == 0 {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, handler.maxUploadBytes+(1<<20))
	if err := r.ParseMultipartForm(handler.maxUploadBytes); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_UPLOAD", "Ukuran logo terlalu besar")
		return
	}

	file, header, err := r.FormFile("logo")
	if err != nil {
		writeError(w, http.StatusBadRequest, "FILE_REQUIRED", "Logo wajib diunggah")
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

	b := make([]byte, 8)
	rand.Read(b)
	filename := fmt.Sprintf("logo-%d-%s.jpg", time.Now().Unix(), hex.EncodeToString(b))
	relativePath := filepath.Join("settings", filename)
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

	logoUrl := "/uploads/" + filepath.ToSlash(relativePath)
	if err := handler.repo.UpdateLogo(r.Context(), userID, logoUrl); err != nil {
		os.Remove(targetPath)
		writeError(w, http.StatusInternalServerError, "UPDATE_LOGO_FAILED", "Gagal memperbarui database")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"data": map[string]string{
			"logo_url": logoUrl,
			"message":  "Logo toko berhasil diperbarui",
		},
	})
}
