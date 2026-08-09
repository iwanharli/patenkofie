package dashboard

import (
	"encoding/json"
	"net/http"
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
	if _, ok := handler.currentUserID(r); !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "Session tidak valid")
		return
	}

	location, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		location = time.Local
	}

	startDate, endDate, message := parseDateRange(r, time.Now().In(location), location)
	if message != "" {
		writeError(w, http.StatusBadRequest, "INVALID_DATE_RANGE", message)
		return
	}

	overview, err := handler.repo.Overview(r.Context(), time.Now(), startDate, endDate)
	if err != nil {
		log.Error().Err(err).Msg("dashboard overview failed")
		writeError(w, http.StatusInternalServerError, "DASHBOARD_FAILED", "Dashboard gagal dibaca")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"data": overviewResponse(overview)})
}

func (handler *Handler) currentUserID(r *http.Request) (int64, bool) {
	actor, ok := auth.ActorFrom(r.Context())
	if !ok {
		return 0, false
	}

	return actor.UserID, true
}

func parseDateRange(r *http.Request, now time.Time, location *time.Location) (time.Time, time.Time, string) {
	startValue := r.URL.Query().Get("start_date")
	endValue := r.URL.Query().Get("end_date")
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location)

	if startValue == "" && endValue == "" {
		return today, today.AddDate(0, 0, 1), ""
	}
	if startValue == "" {
		startValue = endValue
	}
	if endValue == "" {
		endValue = startValue
	}

	startDate, err := time.ParseInLocation("2006-01-02", startValue, location)
	if err != nil {
		return time.Time{}, time.Time{}, "Tanggal mulai tidak valid"
	}
	endDate, err := time.ParseInLocation("2006-01-02", endValue, location)
	if err != nil {
		return time.Time{}, time.Time{}, "Tanggal akhir tidak valid"
	}
	if endDate.Before(startDate) {
		return time.Time{}, time.Time{}, "Tanggal akhir tidak boleh sebelum tanggal mulai"
	}
	if endDate.Sub(startDate).Hours()/24 > 90 {
		return time.Time{}, time.Time{}, "Rentang dashboard maksimal 90 hari"
	}

	return startDate, endDate.AddDate(0, 0, 1), ""
}

func overviewResponse(item Overview) map[string]any {
	queues := make([]map[string]any, 0, len(item.Queues))
	for _, queue := range item.Queues {
		orders := make([]map[string]any, 0, len(queue.Orders))
		for _, order := range queue.Orders {
			orders = append(orders, map[string]any{
				"order_code":    order.OrderCode,
				"customer_name": order.CustomerName,
				"created_at":    order.CreatedAt,
			})
		}

		queues = append(queues, map[string]any{
			"status": queue.Status,
			"count":  queue.Count,
			"orders": orders,
		})
	}

	recentOrders := make([]map[string]any, 0, len(item.RecentOrders))
	for _, order := range item.RecentOrders {
		recentOrders = append(recentOrders, map[string]any{
			"order_code":     order.OrderCode,
			"customer_name":  order.CustomerName,
			"service_code":   order.ServiceCode,
			"service_name":   order.ServiceName,
			"weight_kg":      order.WeightKg,
			"total_amount":   order.TotalAmount,
			"payment_status": order.PaymentStatus,
			"order_status":   order.OrderStatus,
			"created_at":     order.CreatedAt,
		})
	}

	serviceBreakdowns := make([]map[string]any, 0, len(item.ServiceBreakdowns))
	for _, service := range item.ServiceBreakdowns {
		serviceBreakdowns = append(serviceBreakdowns, map[string]any{
			"service_code": service.ServiceCode,
			"service_name": service.ServiceName,
			"order_count":  service.OrderCount,
			"weight_kg":    service.WeightKg,
			"amount":       service.Amount,
		})
	}

	activities := make([]map[string]any, 0, len(item.Activities))
	for _, activity := range item.Activities {
		activities = append(activities, map[string]any{
			"order_code":    activity.OrderCode,
			"customer_name": activity.CustomerName,
			"status":        activity.Status,
			"notes":         activity.Notes,
			"changed_at":    activity.ChangedAt,
		})
	}

	return map[string]any{
		"generated_at":  item.GeneratedAt,
		"business_date": item.BusinessDate,
		"date_range": map[string]any{
			"start_date": item.StartDate.Format("2006-01-02"),
			"end_date":   item.EndDate.AddDate(0, 0, -1).Format("2006-01-02"),
		},
		"summary": map[string]any{
			"transactions_today":        item.Summary.TransactionsToday,
			"transactions_previous":     item.Summary.TransactionsPrevious,
			"coffee_weight_today_kg":    item.Summary.CoffeeWeightTodayKg,
			"cash_amount_today":         item.Summary.CashAmountToday,
			"cash_payments_today":       item.Summary.CashPaymentsToday,
			"outstanding_amount_active": item.Summary.OutstandingAmountActive,
			"outstanding_orders_active": item.Summary.OutstandingOrdersActive,
		},
		"queues":             queues,
		"recent_orders":      recentOrders,
		"service_breakdowns": serviceBreakdowns,
		"pickup_summary": map[string]any{
			"ready_count":        item.PickupSummary.ReadyCount,
			"paid_ready_count":   item.PickupSummary.PaidReadyCount,
			"unpaid_ready_count": item.PickupSummary.UnpaidReadyCount,
		},
		"activities": activities,
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
