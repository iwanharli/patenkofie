package report

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/rs/zerolog/log"

	"paten-kopi/backend/internal/auth"
)

type Handler struct {
	repo         *Repository
	sessionStore *auth.SessionStore
}

func NewHandler(repo *Repository, sessionStore *auth.SessionStore) *Handler {
	return &Handler{repo: repo, sessionStore: sessionStore}
}

func (handler *Handler) Overview(w http.ResponseWriter, r *http.Request) {
	if !handler.isAuthenticated(r) {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	filter := Filter{
		EndDate:       r.URL.Query().Get("end_date"),
		OrderStatus:   r.URL.Query().Get("order_status"),
		PaymentStatus: r.URL.Query().Get("payment_status"),
		ServiceCode:   r.URL.Query().Get("service_code"),
		StartDate:     r.URL.Query().Get("start_date"),
	}

	// Calculate start/end date from "period" shortcut if provided (default: month)
	period := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("period")))
	if period == "" && filter.StartDate == "" && filter.EndDate == "" {
		period = "month"
	}
	if period != "" && (filter.StartDate == "" || filter.EndDate == "") {
		loc, _ := time.LoadLocation("Asia/Jakarta")
		now := time.Now().In(loc)

		switch period {
		case "week":
			filter.StartDate = now.AddDate(0, 0, -6).Format("2006-01-02")
			filter.EndDate = now.Format("2006-01-02")
		case "today":
			filter.StartDate = now.Format("2006-01-02")
			filter.EndDate = now.Format("2006-01-02")
		default: // "month"
			filter.StartDate = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, loc).Format("2006-01-02")
			filter.EndDate = now.Format("2006-01-02")
		}
	}

	overview, err := handler.repo.GetOverview(r.Context(), filter)
	if err != nil {
		log.Error().Err(err).Msg("report overview failed")
		writeError(w, http.StatusInternalServerError, "REPORT_OVERVIEW_FAILED", "Laporan ringkasan gagal dibaca")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"data": overview})
}

func (handler *Handler) Detail(w http.ResponseWriter, r *http.Request) {
	if !handler.isAuthenticated(r) {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	page := parsePositiveInt(r.URL.Query().Get("page"), 1)
	pageSize := parsePositiveInt(r.URL.Query().Get("page_size"), 10)

	filter := DetailFilter{
		Filter: Filter{
			EndDate:       r.URL.Query().Get("end_date"),
			OrderStatus:   r.URL.Query().Get("order_status"),
			PaymentStatus: r.URL.Query().Get("payment_status"),
			ServiceCode:   r.URL.Query().Get("service_code"),
			StartDate:     r.URL.Query().Get("start_date"),
		},
		Limit:  pageSize,
		Offset: (page - 1) * pageSize,
		Type:   r.URL.Query().Get("type"),
	}

	result, err := handler.repo.GetDetail(r.Context(), filter)
	if err != nil {
		log.Error().Err(err).Str("type", filter.Type).Msg("report detail failed")
		writeError(w, http.StatusInternalServerError, "REPORT_DETAIL_FAILED", "Detail laporan gagal dibaca")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"data": result.Items,
		"meta": map[string]any{
			"metric_text": result.MetricText,
			"page":        page,
			"page_size":   pageSize,
			"total_items": result.Total,
		},
	})
}

func (handler *Handler) ExportCSV(w http.ResponseWriter, r *http.Request) {
	if !handler.isAuthenticated(r) {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	reportType := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("type")))
	if reportType == "" {
		reportType = "orders"
	}

	startDate := r.URL.Query().Get("start_date")
	endDate := r.URL.Query().Get("end_date")
	period := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("period")))
	if period == "" && startDate == "" && endDate == "" {
		period = "month"
	}

	if period != "" && (startDate == "" || endDate == "") {
		loc, _ := time.LoadLocation("Asia/Jakarta")
		now := time.Now().In(loc)

		switch period {
		case "week":
			startDate = now.AddDate(0, 0, -6).Format("2006-01-02")
			endDate = now.Format("2006-01-02")
		case "today":
			startDate = now.Format("2006-01-02")
			endDate = now.Format("2006-01-02")
		default: // "month"
			startDate = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, loc).Format("2006-01-02")
			endDate = now.Format("2006-01-02")
		}
	}

	filter := DetailFilter{
		Filter: Filter{
			EndDate:       endDate,
			OrderStatus:   r.URL.Query().Get("order_status"),
			PaymentStatus: r.URL.Query().Get("payment_status"),
			ServiceCode:   r.URL.Query().Get("service_code"),
			StartDate:     startDate,
		},
		Limit:  10000, // Export up to 10k rows
		Offset: 0,
		Type:   reportType,
	}

	filename := fmt.Sprintf("laporan-%s-%s.csv", reportType, time.Now().Format("20060102-150405"))
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))

	writer := csv.NewWriter(w)

	if err := handler.repo.ExportCSVData(r.Context(), filter, writer); err != nil {
		log.Error().Err(err).Str("type", reportType).Msg("export csv report failed")
		return
	}
}

func (handler *Handler) isAuthenticated(r *http.Request) bool {
	cookie, err := r.Cookie(auth.SessionCookieName)
	if err != nil {
		return false
	}

	session, ok := handler.sessionStore.Get(cookie.Value)
	return ok && session.UserID != 0
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
