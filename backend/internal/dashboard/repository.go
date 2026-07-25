package dashboard

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (repo *Repository) Overview(ctx context.Context, now time.Time, startDate time.Time, endDate time.Time) (Overview, error) {
	location, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		location = now.Location()
	}
	localNow := now.In(location)
	startDate = startDate.In(location)
	endDate = endDate.In(location)
	periodDuration := endDate.Sub(startDate)
	if periodDuration <= 0 {
		periodDuration = 24 * time.Hour
	}
	previousStartDate := startDate.Add(-periodDuration)

	summary, err := repo.summary(ctx, startDate, endDate, previousStartDate)
	if err != nil {
		return Overview{}, err
	}

	queues, err := repo.queues(ctx)
	if err != nil {
		return Overview{}, err
	}

	recentOrders, err := repo.recentOrders(ctx, startDate, endDate)
	if err != nil {
		return Overview{}, err
	}

	serviceBreakdowns, err := repo.serviceBreakdowns(ctx, startDate, endDate)
	if err != nil {
		return Overview{}, err
	}

	pickupSummary, err := repo.pickupSummary(ctx)
	if err != nil {
		return Overview{}, err
	}

	activities, err := repo.activities(ctx, startDate, endDate)
	if err != nil {
		return Overview{}, err
	}

	return Overview{
		GeneratedAt:       localNow,
		BusinessDate:      startDate,
		StartDate:         startDate,
		EndDate:           endDate,
		Summary:           summary,
		Queues:            queues,
		RecentOrders:      recentOrders,
		ServiceBreakdowns: serviceBreakdowns,
		PickupSummary:     pickupSummary,
		Activities:        activities,
	}, nil
}

func (repo *Repository) summary(ctx context.Context, startDate time.Time, endDate time.Time, previousStartDate time.Time) (Summary, error) {
	var item Summary
	if err := repo.db.QueryRow(ctx, `
		WITH period_orders AS (
			SELECT id, weight_kg, total_amount
			FROM orders
			WHERE created_at >= $1
				AND created_at < $2
				AND order_status <> 'DIBATALKAN'
		),
		previous_orders AS (
			SELECT id
			FROM orders
			WHERE created_at >= $3
				AND created_at < $1
				AND order_status <> 'DIBATALKAN'
		),
		period_payments AS (
			SELECT amount
			FROM payments
			WHERE paid_at >= $1
				AND paid_at < $2
		),
		active_outstanding AS (
			SELECT total_amount - paid_amount AS remaining
			FROM orders
			WHERE order_status NOT IN ('SELESAI', 'DIBATALKAN')
				AND total_amount > paid_amount
		)
		SELECT
			(SELECT count(*) FROM period_orders),
			(SELECT count(*) FROM previous_orders),
			(SELECT COALESCE(sum(weight_kg), 0)::text FROM period_orders),
			(SELECT COALESCE(sum(amount), 0) FROM period_payments),
			(SELECT count(*) FROM period_payments),
			(SELECT COALESCE(sum(remaining), 0) FROM active_outstanding),
			(SELECT count(*) FROM active_outstanding)
	`, startDate, endDate, previousStartDate).Scan(
		&item.TransactionsToday,
		&item.TransactionsPrevious,
		&item.CoffeeWeightTodayKg,
		&item.CashAmountToday,
		&item.CashPaymentsToday,
		&item.OutstandingAmountActive,
		&item.OutstandingOrdersActive,
	); err != nil {
		return Summary{}, fmt.Errorf("dashboard summary: %w", err)
	}

	return item, nil
}

func (repo *Repository) queues(ctx context.Context) ([]QueueSummary, error) {
	counts := map[string]int64{
		"DIPROSES":     0,
		"MENUNGGU":     0,
		"SIAP_DIAMBIL": 0,
	}
	rows, err := repo.db.Query(ctx, `
		SELECT order_status, count(*)
		FROM orders
		WHERE order_status IN ('MENUNGGU', 'DIPROSES', 'SIAP_DIAMBIL')
		GROUP BY order_status
	`)
	if err != nil {
		return nil, fmt.Errorf("dashboard queue counts: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var status string
		var count int64
		if err := rows.Scan(&status, &count); err != nil {
			return nil, fmt.Errorf("scan dashboard queue count: %w", err)
		}
		counts[status] = count
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate dashboard queue counts: %w", err)
	}

	items := []QueueSummary{
		{Status: "MENUNGGU", Count: counts["MENUNGGU"], Orders: []QueueOrder{}},
		{Status: "DIPROSES", Count: counts["DIPROSES"], Orders: []QueueOrder{}},
		{Status: "SIAP_DIAMBIL", Count: counts["SIAP_DIAMBIL"], Orders: []QueueOrder{}},
	}
	indexByStatus := map[string]int{
		"MENUNGGU":     0,
		"DIPROSES":     1,
		"SIAP_DIAMBIL": 2,
	}

	rows, err = repo.db.Query(ctx, `
		SELECT order_status, order_code, customer_name, created_at
		FROM (
			SELECT o.order_status, o.order_code, c.name AS customer_name, o.created_at,
				row_number() OVER (PARTITION BY o.order_status ORDER BY o.created_at DESC, o.id DESC) AS row_number
			FROM orders o
			JOIN customers c ON c.id = o.customer_id
			WHERE o.order_status IN ('MENUNGGU', 'DIPROSES', 'SIAP_DIAMBIL')
		) ranked_orders
		WHERE row_number <= 3
		ORDER BY order_status, created_at DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("dashboard queue orders: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var status string
		var order QueueOrder
		if err := rows.Scan(&status, &order.OrderCode, &order.CustomerName, &order.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan dashboard queue order: %w", err)
		}
		if index, ok := indexByStatus[status]; ok {
			items[index].Orders = append(items[index].Orders, order)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate dashboard queue orders: %w", err)
	}

	return items, nil
}

func (repo *Repository) recentOrders(ctx context.Context, startDate time.Time, endDate time.Time) ([]RecentOrder, error) {
	rows, err := repo.db.Query(ctx, `
		SELECT o.order_code, c.name, s.code, s.name, o.weight_kg::text, o.total_amount,
			o.payment_status, o.order_status, o.created_at
		FROM orders o
		JOIN customers c ON c.id = o.customer_id
		JOIN services s ON s.id = o.service_id
		WHERE o.created_at >= $1
			AND o.created_at < $2
		ORDER BY o.created_at DESC, o.id DESC
		LIMIT 14
	`, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("dashboard recent orders: %w", err)
	}
	defer rows.Close()

	items := make([]RecentOrder, 0, 14)
	for rows.Next() {
		var item RecentOrder
		if err := rows.Scan(
			&item.OrderCode,
			&item.CustomerName,
			&item.ServiceCode,
			&item.ServiceName,
			&item.WeightKg,
			&item.TotalAmount,
			&item.PaymentStatus,
			&item.OrderStatus,
			&item.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan dashboard recent order: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate dashboard recent orders: %w", err)
	}

	return items, nil
}

func (repo *Repository) serviceBreakdowns(ctx context.Context, startOfDay time.Time, endOfDay time.Time) ([]ServiceBreakdown, error) {
	rows, err := repo.db.Query(ctx, `
		SELECT s.code, s.name, count(o.id), COALESCE(sum(o.weight_kg), 0)::text, COALESCE(sum(o.total_amount), 0)
		FROM services s
		LEFT JOIN orders o ON o.service_id = s.id
			AND o.created_at >= $1
			AND o.created_at < $2
			AND o.order_status <> 'DIBATALKAN'
		WHERE s.is_active = true
		GROUP BY s.id, s.code, s.name
		ORDER BY s.code
	`, startOfDay, endOfDay)
	if err != nil {
		return nil, fmt.Errorf("dashboard service breakdowns: %w", err)
	}
	defer rows.Close()

	items := []ServiceBreakdown{}
	for rows.Next() {
		var item ServiceBreakdown
		if err := rows.Scan(&item.ServiceCode, &item.ServiceName, &item.OrderCount, &item.WeightKg, &item.Amount); err != nil {
			return nil, fmt.Errorf("scan dashboard service breakdown: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate dashboard service breakdowns: %w", err)
	}

	return items, nil
}

func (repo *Repository) pickupSummary(ctx context.Context) (PickupSummary, error) {
	var item PickupSummary
	if err := repo.db.QueryRow(ctx, `
		SELECT
			count(*),
			count(*) FILTER (WHERE payment_status = 'LUNAS'),
			count(*) FILTER (WHERE payment_status <> 'LUNAS')
		FROM orders
		WHERE order_status = 'SIAP_DIAMBIL'
	`).Scan(&item.ReadyCount, &item.PaidReadyCount, &item.UnpaidReadyCount); err != nil {
		return PickupSummary{}, fmt.Errorf("dashboard pickup summary: %w", err)
	}

	return item, nil
}

func (repo *Repository) activities(ctx context.Context, startOfDay time.Time, endOfDay time.Time) ([]ActivityItem, error) {
	rows, err := repo.db.Query(ctx, `
		SELECT o.order_code, c.name, osl.new_status, osl.notes, osl.changed_at
		FROM order_status_logs osl
		JOIN orders o ON o.id = osl.order_id
		JOIN customers c ON c.id = o.customer_id
		WHERE osl.changed_at >= $1
			AND osl.changed_at < $2
		ORDER BY osl.changed_at DESC, osl.id DESC
		LIMIT 5
	`, startOfDay, endOfDay)
	if err != nil {
		return nil, fmt.Errorf("dashboard activities: %w", err)
	}
	defer rows.Close()

	items := make([]ActivityItem, 0, 5)
	for rows.Next() {
		var item ActivityItem
		if err := rows.Scan(&item.OrderCode, &item.CustomerName, &item.Status, &item.Notes, &item.ChangedAt); err != nil {
			return nil, fmt.Errorf("scan dashboard activity: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate dashboard activities: %w", err)
	}

	return items, nil
}
