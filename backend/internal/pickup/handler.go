package pickup

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"
	xdraw "golang.org/x/image/draw"
	_ "golang.org/x/image/webp"

	"paten-kopi/backend/internal/auth"
)

const (
	storedPhotoJPEGQuality  = 85
	storedPhotoMaxDimension = 1600
)

type Handler struct {
	maxUploadBytes int64
	repo           *Repository
	uploadDir      string
}

func NewHandler(repo *Repository, uploadDir string, maxUploadBytes int64) *Handler {
	if maxUploadBytes <= 0 {
		maxUploadBytes = 2 << 20
	}

	return &Handler{
		maxUploadBytes: maxUploadBytes,
		repo:           repo,
		uploadDir:      uploadDir,
	}
}

func (handler *Handler) Detail(w http.ResponseWriter, r *http.Request) {
	if _, ok := handler.currentUserID(r); !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	item, err := handler.repo.FindByOrderCode(r.Context(), chi.URLParam(r, "code"))
	if errors.Is(err, ErrOrderNotFound) {
		writeError(w, http.StatusNotFound, "PICKUP_NOT_FOUND", "Bukti pengambilan belum dibuat")
		return
	}
	if err != nil {
		log.Error().Err(err).Str("order_code", chi.URLParam(r, "code")).Msg("pickup detail failed")
		writeError(w, http.StatusInternalServerError, "PICKUP_DETAIL_FAILED", "Bukti pengambilan gagal dibaca")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"data": pickupResponse(item)})
}

func (handler *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := handler.currentUserID(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, handler.maxUploadBytes+(1<<20))
	if err := r.ParseMultipartForm(handler.maxUploadBytes); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_PICKUP_FORM", "Form serah terima tidak valid atau foto terlalu besar")
		return
	}

	recipientName := strings.TrimSpace(r.FormValue("recipient_name"))
	if recipientName == "" {
		writeError(w, http.StatusBadRequest, "RECIPIENT_NAME_REQUIRED", "Nama pengambil wajib diisi")
		return
	}

	recipientType := strings.ToUpper(strings.TrimSpace(r.FormValue("recipient_type")))
	if recipientType == "" {
		recipientType = "CUSTOMER"
	}
	if recipientType != "CUSTOMER" && recipientType != "REPRESENTATIVE" {
		writeError(w, http.StatusBadRequest, "INVALID_RECIPIENT_TYPE", "Tipe pengambil tidak valid")
		return
	}

	photoPath, err := handler.saveUploadedPhoto(r, chi.URLParam(r, "code"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_PICKUP_PHOTO", err.Error())
		return
	}

	item, err := handler.repo.Create(r.Context(), CreatePickupInput{
		OrderCode:      chi.URLParam(r, "code"),
		RecipientName:  recipientName,
		RecipientType:  recipientType,
		RecipientPhone: optionalString(r.FormValue("recipient_phone")),
		PhotoPath:      photoPath,
		HandedOverBy:   userID,
		Notes:          optionalString(r.FormValue("notes")),
	})
	if errors.Is(err, ErrOrderNotFound) {
		_ = handler.removeStoredPhoto(photoPath)
		writeError(w, http.StatusNotFound, "ORDER_NOT_FOUND", "Transaksi tidak ditemukan")
		return
	}
	if errors.Is(err, ErrPickupExists) {
		_ = handler.removeStoredPhoto(photoPath)
		writeError(w, http.StatusConflict, "PICKUP_EXISTS", "Bukti pengambilan untuk transaksi ini sudah dibuat")
		return
	}
	if err != nil {
		_ = handler.removeStoredPhoto(photoPath)
		log.Error().Err(err).Str("order_code", chi.URLParam(r, "code")).Msg("create pickup failed")
		writeError(w, http.StatusInternalServerError, "CREATE_PICKUP_FAILED", "Bukti pengambilan gagal disimpan")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"data": pickupResponse(item)})
}

func (handler *Handler) saveUploadedPhoto(r *http.Request, orderCode string) (string, error) {
	file, header, err := r.FormFile("photo")
	if err != nil {
		return "", errors.New("Foto bukti pengambilan wajib diunggah")
	}
	defer file.Close()

	if header.Size > handler.maxUploadBytes {
		return "", errors.New("Ukuran foto melebihi batas upload")
	}

	buffer := make([]byte, 512)
	readBytes, readErr := io.ReadFull(file, buffer)
	if readErr != nil && !errors.Is(readErr, io.ErrUnexpectedEOF) {
		return "", errors.New("Foto gagal dibaca")
	}

	if !isAllowedImageContentType(http.DetectContentType(buffer[:readBytes])) {
		return "", errors.New("Format foto harus JPG, PNG, atau WebP")
	}

	decodedImage, _, err := image.Decode(io.MultiReader(bytes.NewReader(buffer[:readBytes]), file))
	if err != nil {
		return "", errors.New("Foto gagal diproses")
	}

	filename := fmt.Sprintf("%s-%d-%s.jpg", safeFileToken(orderCode), time.Now().UnixNano(), randomToken())
	relativePath := filepath.Join("pickups", filename)
	targetPath := filepath.Join(handler.uploadDir, relativePath)

	if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
		return "", errors.New("Folder upload gagal dibuat")
	}

	target, err := os.Create(targetPath)
	if err != nil {
		return "", errors.New("File foto gagal dibuat")
	}
	defer target.Close()

	compressedImage := prepareStoredPhoto(decodedImage)
	if err := jpeg.Encode(target, compressedImage, &jpeg.Options{Quality: storedPhotoJPEGQuality}); err != nil {
		return "", errors.New("Foto gagal disimpan")
	}

	return "/uploads/" + filepath.ToSlash(relativePath), nil
}

func (handler *Handler) removeStoredPhoto(photoPath string) error {
	relativePath := strings.TrimPrefix(photoPath, "/uploads/")
	if relativePath == "" || strings.Contains(relativePath, "..") {
		return nil
	}

	return os.Remove(filepath.Join(handler.uploadDir, filepath.FromSlash(relativePath)))
}

func (handler *Handler) currentUserID(r *http.Request) (int64, bool) {
	actor, ok := auth.ActorFrom(r.Context())
	if !ok || actor.UserID == 0 {
		return 0, false
	}

	return actor.UserID, true
}

func isAllowedImageContentType(contentType string) bool {
	switch contentType {
	case "image/jpeg", "image/png", "image/webp":
		return true
	default:
		return false
	}
}

func prepareStoredPhoto(source image.Image) image.Image {
	bounds := source.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()
	if width <= 0 || height <= 0 {
		return source
	}

	targetWidth, targetHeight := resizedDimensions(width, height, storedPhotoMaxDimension)
	target := image.NewRGBA(image.Rect(0, 0, targetWidth, targetHeight))
	xdraw.Draw(target, target.Bounds(), &image.Uniform{C: color.White}, image.Point{}, xdraw.Src)
	xdraw.CatmullRom.Scale(target, target.Bounds(), source, bounds, xdraw.Over, nil)

	return target
}

func resizedDimensions(width int, height int, maxDimension int) (int, int) {
	if width <= maxDimension && height <= maxDimension {
		return width, height
	}

	if width >= height {
		targetWidth := maxDimension
		targetHeight := int(float64(height) * float64(maxDimension) / float64(width))
		if targetHeight < 1 {
			targetHeight = 1
		}
		return targetWidth, targetHeight
	}

	targetHeight := maxDimension
	targetWidth := int(float64(width) * float64(maxDimension) / float64(height))
	if targetWidth < 1 {
		targetWidth = 1
	}

	return targetWidth, targetHeight
}

func randomToken() string {
	var data [4]byte
	if _, err := rand.Read(data[:]); err != nil {
		return "photo"
	}

	return hex.EncodeToString(data[:])
}

func safeFileToken(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	var builder strings.Builder
	for _, char := range value {
		if (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') || char == '-' {
			builder.WriteRune(char)
		}
	}
	if builder.Len() == 0 {
		return "pickup"
	}

	return builder.String()
}

func optionalString(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}

	return &trimmed
}

func pickupResponse(item Pickup) map[string]any {
	handedOverName := "Petugas"
	if item.HandedOverName != nil && *item.HandedOverName != "" {
		handedOverName = *item.HandedOverName
	}

	return map[string]any{
		"id":               item.ID,
		"order_code":       item.OrderCode,
		"recipient_name":   item.RecipientName,
		"recipient_type":   item.RecipientType,
		"recipient_phone":  item.RecipientPhone,
		"photo_path":       item.PhotoPath,
		"handed_over_by":   item.HandedOverBy,
		"handed_over_name": handedOverName,
		"picked_up_at":     item.PickedUpAt,
		"notes":            item.Notes,
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
