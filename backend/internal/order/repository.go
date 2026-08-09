package order

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrBulkOrderStatusMismatch = errors.New("bulk order status mismatch")
	ErrOrderNotEditable        = errors.New("order not editable")
	ErrOrderNotFound           = errors.New("order not found")
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (repo *Repository) List(ctx context.Context, filter ListOrdersFilter) (OrderListResult, error) {
	whereClauses := []string{"1 = 1"}
	args := []any{}

	if filter.Search != "" {
		args = append(args, "%"+strings.ToLower(filter.Search)+"%")
		whereClauses = append(whereClauses, fmt.Sprintf(
			"(lower(o.order_code) LIKE $%d OR lower(c.name) LIKE $%d OR lower(COALESCE(c.phone, '')) LIKE $%d)",
			len(args), len(args), len(args),
		))
	}
	if filter.ServiceCode != "" {
		args = append(args, filter.ServiceCode)
		whereClauses = append(whereClauses, fmt.Sprintf("s.code = $%d", len(args)))
	}
	if filter.OrderStatus != "" {
		args = append(args, filter.OrderStatus)
		whereClauses = append(whereClauses, fmt.Sprintf("o.order_status = $%d", len(args)))
	}
	if filter.PaymentStatus != "" {
		args = append(args, filter.PaymentStatus)
		whereClauses = append(whereClauses, fmt.Sprintf("o.payment_status = $%d", len(args)))
	}

	orderBy := orderListSortClause(filter.SortBy, filter.SortDirection)
	args = append(args, filter.Limit, filter.Offset)
	limitParam := len(args) - 1
	offsetParam := len(args)

	query := fmt.Sprintf(`
		SELECT o.id, o.order_code, o.customer_id, c.name, c.phone, o.service_id, s.code,
			s.name, o.weight_kg::text, o.price_per_kg, o.total_amount, o.paid_amount,
			o.payment_status, o.order_status, o.roast_level, o.grind_level, o.notes,
			o.created_by, o.created_at, o.updated_at, count(*) OVER() AS total_count
		FROM orders o
		JOIN customers c ON c.id = o.customer_id
		JOIN services s ON s.id = o.service_id
		WHERE %s
		ORDER BY %s
		LIMIT $%d OFFSET $%d
	`, strings.Join(whereClauses, " AND "), orderBy, limitParam, offsetParam)

	rows, err := repo.db.Query(ctx, query, args...)
	if err != nil {
		return OrderListResult{}, fmt.Errorf("list orders: %w", err)
	}
	defer rows.Close()

	result := OrderListResult{
		Items: make([]Order, 0),
	}
	for rows.Next() {
		var item Order
		if err := rows.Scan(
			&item.ID,
			&item.OrderCode,
			&item.CustomerID,
			&item.CustomerName,
			&item.CustomerPhone,
			&item.ServiceID,
			&item.ServiceCode,
			&item.ServiceName,
			&item.WeightKg,
			&item.PricePerKg,
			&item.TotalAmount,
			&item.PaidAmount,
			&item.PaymentStatus,
			&item.OrderStatus,
			&item.RoastLevel,
			&item.GrindLevel,
			&item.Notes,
			&item.CreatedBy,
			&item.CreatedAt,
			&item.UpdatedAt,
			&result.Total,
		); err != nil {
			return OrderListResult{}, fmt.Errorf("scan order: %w", err)
		}
		result.Items = append(result.Items, item)
	}
	if err := rows.Err(); err != nil {
		return OrderListResult{}, fmt.Errorf("iterate orders: %w", err)
	}

	if len(result.Items) == 0 {
		countQuery := fmt.Sprintf(`
			SELECT count(*)
			FROM orders o
			JOIN customers c ON c.id = o.customer_id
			JOIN services s ON s.id = o.service_id
			WHERE %s
		`, strings.Join(whereClauses, " AND "))
		if err := repo.db.QueryRow(ctx, countQuery, args[:len(args)-2]...).Scan(&result.Total); err != nil {
			return OrderListResult{}, fmt.Errorf("count orders: %w", err)
		}
	}

	return result, nil
}

func orderListSortClause(sortBy string, direction string) string {
	direction = strings.ToUpper(strings.TrimSpace(direction))
	if direction != "ASC" {
		direction = "DESC"
	}

	switch strings.ToLower(strings.TrimSpace(sortBy)) {
	case "code":
		return "o.order_code " + direction + ", o.id DESC"
	case "customer":
		return "c.name " + direction + ", o.id DESC"
	case "payment_status":
		return "o.payment_status " + direction + ", o.id DESC"
	case "service":
		return "s.code " + direction + ", o.id DESC"
	case "status":
		return "o.order_status " + direction + ", o.id DESC"
	case "total":
		return "o.total_amount " + direction + ", o.id DESC"
	case "weight":
		return "o.weight_kg " + direction + ", o.id DESC"
	default:
		return "o.created_at " + direction + ", o.id " + direction
	}
}

func (repo *Repository) Create(ctx context.Context, input CreateOrderInput) (Order, error) {
	tx, err := repo.db.Begin(ctx)
	if err != nil {
		return Order{}, fmt.Errorf("begin create order: %w", err)
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	var service struct {
		ID         int16
		Code       string
		Name       string
		PricePerKg int64
	}
	err = tx.QueryRow(ctx, `
		SELECT id, code, name, price_per_kg
		FROM services
		WHERE code = $1 AND is_active = true
	`, input.ServiceCode).Scan(&service.ID, &service.Code, &service.Name, &service.PricePerKg)
	if errors.Is(err, pgx.ErrNoRows) {
		return Order{}, fmt.Errorf("service not found: %w", err)
	}
	if err != nil {
		return Order{}, fmt.Errorf("find service: %w", err)
	}

	customerID, err := repo.upsertCustomer(ctx, tx, input.CustomerName, input.CustomerPhone, input.Notes)
	if err != nil {
		return Order{}, err
	}

	now := time.Now()
	businessDate := now.Format("2006-01-02")
	sequence, err := repo.nextDailySequence(ctx, tx, businessDate, service.Code)
	if err != nil {
		return Order{}, err
	}

	orderCode := fmt.Sprintf("Paten-%s-%s-%04d", service.Code, now.Format("060102"), sequence)
	weightKg := fmt.Sprintf("%.3f", float64(input.WeightGrams)/1000)
	totalAmount := int64(math.Round(float64(service.PricePerKg) * float64(input.WeightGrams) / 1000))
	paidAmount := input.PaidAmount
	paymentStatus := "BELUM_BAYAR"

	if input.PaymentType == "FULL_PAYMENT" {
		paidAmount = totalAmount
	}
	if paidAmount >= totalAmount {
		paidAmount = totalAmount
		paymentStatus = "LUNAS"
	} else if paidAmount > 0 {
		paymentStatus = "DP"
	}

	var item Order
	err = tx.QueryRow(ctx, `
		INSERT INTO orders (
			order_code, customer_id, service_id, weight_kg, price_per_kg, total_amount,
			paid_amount, payment_status, order_status, roast_level, grind_level, notes, created_by
		)
		VALUES ($1, $2, $3, $4::numeric, $5, $6, $7, $8, 'MENUNGGU', $9, $10, $11, $12)
		RETURNING id, order_code, customer_id, service_id, weight_kg::text, price_per_kg,
			total_amount, paid_amount, payment_status, order_status, roast_level, grind_level,
			notes, created_by, created_at, updated_at
	`, orderCode, customerID, service.ID, weightKg, service.PricePerKg, totalAmount, paidAmount,
		paymentStatus, input.RoastLevel, input.GrindLevel, input.Notes, input.CreatedBy).Scan(
		&item.ID,
		&item.OrderCode,
		&item.CustomerID,
		&item.ServiceID,
		&item.WeightKg,
		&item.PricePerKg,
		&item.TotalAmount,
		&item.PaidAmount,
		&item.PaymentStatus,
		&item.OrderStatus,
		&item.RoastLevel,
		&item.GrindLevel,
		&item.Notes,
		&item.CreatedBy,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		return Order{}, fmt.Errorf("insert order: %w", err)
	}

	item.CustomerName = input.CustomerName
	item.CustomerPhone = input.CustomerPhone
	item.ServiceCode = service.Code
	item.ServiceName = service.Name

	if paidAmount > 0 {
		paymentType := "DOWN_PAYMENT"
		if paidAmount == totalAmount {
			paymentType = "FULL_PAYMENT"
		}

		_, err = tx.Exec(ctx, `
			INSERT INTO payments (order_id, payment_type, amount, received_by, notes)
			VALUES ($1, $2, $3, $4, $5)
		`, item.ID, paymentType, paidAmount, input.CreatedBy, "Pembayaran awal transaksi")
		if err != nil {
			return Order{}, fmt.Errorf("insert payment: %w", err)
		}
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO order_status_logs (order_id, previous_status, new_status, changed_by, notes)
		VALUES ($1, NULL, 'MENUNGGU', $2, 'Transaksi dibuat')
	`, item.ID, input.CreatedBy)
	if err != nil {
		return Order{}, fmt.Errorf("insert status log: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
		VALUES ($1, 'CREATE_ORDER', 'orders', $2, jsonb_build_object('order_code', $3::text))
	`, input.CreatedBy, fmt.Sprint(item.ID), item.OrderCode)
	if err != nil {
		return Order{}, fmt.Errorf("insert audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return Order{}, fmt.Errorf("commit create order: %w", err)
	}

	return item, nil
}

func (repo *Repository) FindByCode(ctx context.Context, code string) (Order, error) {
	trimmed := strings.TrimSpace(code)
	var item Order
	err := repo.db.QueryRow(ctx, `
		SELECT o.id, o.order_code, o.customer_id, c.name, c.phone, o.service_id, s.code,
			s.name, o.weight_kg::text, o.price_per_kg, o.total_amount, o.paid_amount,
			o.payment_status, o.order_status, o.roast_level, o.grind_level, o.notes,
			o.created_by, COALESCE(uc.name, 'Sistem') AS created_by_name,
			up.name AS picked_up_by_name,
			o.created_at, o.updated_at
		FROM orders o
		JOIN customers c ON c.id = o.customer_id
		JOIN services s ON s.id = o.service_id
		LEFT JOIN users uc ON uc.id = o.created_by
		LEFT JOIN pickups pk ON pk.order_id = o.id
		LEFT JOIN users up ON up.id = pk.handed_over_by
		WHERE lower(o.order_code) = lower($1) OR o.id::text = $1
	`, trimmed).Scan(
		&item.ID,
		&item.OrderCode,
		&item.CustomerID,
		&item.CustomerName,
		&item.CustomerPhone,
		&item.ServiceID,
		&item.ServiceCode,
		&item.ServiceName,
		&item.WeightKg,
		&item.PricePerKg,
		&item.TotalAmount,
		&item.PaidAmount,
		&item.PaymentStatus,
		&item.OrderStatus,
		&item.RoastLevel,
		&item.GrindLevel,
		&item.Notes,
		&item.CreatedBy,
		&item.CreatedByName,
		&item.PickedUpByName,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Order{}, ErrOrderNotFound
	}
	if err != nil {
		return Order{}, fmt.Errorf("find order by code: %w", err)
	}

	// Fetch status change history and officer logs
	logsRows, err := repo.db.Query(ctx, `
		SELECT
			osl.previous_status,
			osl.new_status,
			COALESCE(u.name, 'Sistem') AS changed_by_name,
			osl.changed_at,
			COALESCE(osl.notes, '') AS notes
		FROM order_status_logs osl
		LEFT JOIN users u ON u.id = osl.changed_by
		WHERE osl.order_id = $1
		ORDER BY osl.changed_at ASC
	`, item.ID)
	if err == nil {
		defer logsRows.Close()
		logs := make([]OrderStatusLogItem, 0)
		for logsRows.Next() {
			var l OrderStatusLogItem
			if scanErr := logsRows.Scan(&l.PreviousStatus, &l.NewStatus, &l.ChangedByName, &l.ChangedAt, &l.Notes); scanErr == nil {
				logs = append(logs, l)
			}
		}
		item.StatusLogs = logs
	}

	return item, nil
}

func (repo *Repository) DeleteByCode(ctx context.Context, code string, actorID int64) (Order, error) {
	tx, err := repo.db.Begin(ctx)
	if err != nil {
		return Order{}, fmt.Errorf("begin delete order: %w", err)
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	var item Order
	err = tx.QueryRow(ctx, `
		SELECT o.id, o.order_code, o.customer_id, c.name, c.phone, o.service_id, s.code,
			s.name, o.weight_kg::text, o.price_per_kg, o.total_amount, o.paid_amount,
			o.payment_status, o.order_status, o.roast_level, o.grind_level, o.notes,
			o.created_by, o.created_at, o.updated_at
		FROM orders o
		JOIN customers c ON c.id = o.customer_id
		JOIN services s ON s.id = o.service_id
		WHERE o.order_code = $1
		FOR UPDATE OF o
	`, code).Scan(
		&item.ID,
		&item.OrderCode,
		&item.CustomerID,
		&item.CustomerName,
		&item.CustomerPhone,
		&item.ServiceID,
		&item.ServiceCode,
		&item.ServiceName,
		&item.WeightKg,
		&item.PricePerKg,
		&item.TotalAmount,
		&item.PaidAmount,
		&item.PaymentStatus,
		&item.OrderStatus,
		&item.RoastLevel,
		&item.GrindLevel,
		&item.Notes,
		&item.CreatedBy,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Order{}, ErrOrderNotFound
	}
	if err != nil {
		return Order{}, fmt.Errorf("find order for delete: %w", err)
	}

	if _, err := tx.Exec(ctx, `DELETE FROM pickups WHERE order_id = $1`, item.ID); err != nil {
		return Order{}, fmt.Errorf("delete pickups: %w", err)
	}
	if _, err := tx.Exec(ctx, `DELETE FROM payments WHERE order_id = $1`, item.ID); err != nil {
		return Order{}, fmt.Errorf("delete payments: %w", err)
	}
	if _, err := tx.Exec(ctx, `DELETE FROM order_status_logs WHERE order_id = $1`, item.ID); err != nil {
		return Order{}, fmt.Errorf("delete status logs: %w", err)
	}
	if _, err := tx.Exec(ctx, `DELETE FROM orders WHERE id = $1`, item.ID); err != nil {
		return Order{}, fmt.Errorf("delete order: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
		VALUES (
			$1,
			'DELETE_ORDER',
			'orders',
			$2,
			jsonb_build_object(
				'order_code', $3::text,
				'customer_name', $4::text,
				'total_amount', $5::bigint
			)
		)
	`, actorID, fmt.Sprint(item.ID), item.OrderCode, item.CustomerName, item.TotalAmount); err != nil {
		return Order{}, fmt.Errorf("insert delete audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return Order{}, fmt.Errorf("commit delete order: %w", err)
	}

	return item, nil
}

func (repo *Repository) UpdateStatus(ctx context.Context, code string, input UpdateOrderStatusInput) (Order, error) {
	tx, err := repo.db.Begin(ctx)
	if err != nil {
		return Order{}, fmt.Errorf("begin update order status: %w", err)
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	var orderID int64
	var previousStatus string
	err = tx.QueryRow(ctx, `
		SELECT id, order_status
		FROM orders
		WHERE order_code = $1
		FOR UPDATE
	`, code).Scan(&orderID, &previousStatus)
	if errors.Is(err, pgx.ErrNoRows) {
		return Order{}, ErrOrderNotFound
	}
	if err != nil {
		return Order{}, fmt.Errorf("find order for status update: %w", err)
	}

	_, err = tx.Exec(ctx, `
		UPDATE orders
		SET order_status = $1
		WHERE id = $2
	`, input.OrderStatus, orderID)
	if err != nil {
		return Order{}, fmt.Errorf("update order status: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO order_status_logs (order_id, previous_status, new_status, changed_by, notes)
		VALUES ($1, $2, $3, $4, $5)
	`, orderID, previousStatus, input.OrderStatus, input.ActorID, input.Notes)
	if err != nil {
		return Order{}, fmt.Errorf("insert status log: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
		VALUES (
			$1,
			'UPDATE_ORDER_STATUS',
			'orders',
			$2,
			jsonb_build_object(
				'order_code', $3::text,
				'previous_status', $4::text,
				'new_status', $5::text
			)
		)
	`, input.ActorID, fmt.Sprint(orderID), code, previousStatus, input.OrderStatus)
	if err != nil {
		return Order{}, fmt.Errorf("insert status audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return Order{}, fmt.Errorf("commit update order status: %w", err)
	}

	return repo.FindByCode(ctx, code)
}

func (repo *Repository) BulkUpdateStatus(ctx context.Context, input BulkUpdateOrderStatusInput) (BulkUpdateOrderStatusResult, error) {
	result := BulkUpdateOrderStatusResult{
		RequestedCount: len(input.OrderCodes),
	}
	if len(input.OrderCodes) == 0 {
		return result, nil
	}

	tx, err := repo.db.Begin(ctx)
	if err != nil {
		return BulkUpdateOrderStatusResult{}, fmt.Errorf("begin bulk update order status: %w", err)
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	rows, err := tx.Query(ctx, `
		SELECT id, order_code, order_status
		FROM orders
		WHERE order_code = ANY($1::text[])
		FOR UPDATE
	`, input.OrderCodes)
	if err != nil {
		return BulkUpdateOrderStatusResult{}, fmt.Errorf("find orders for bulk status update: %w", err)
	}
	defer rows.Close()

	type lockedOrder struct {
		ID             int64
		OrderCode      string
		PreviousStatus string
	}

	items := make([]lockedOrder, 0, len(input.OrderCodes))
	for rows.Next() {
		var item lockedOrder
		if err := rows.Scan(&item.ID, &item.OrderCode, &item.PreviousStatus); err != nil {
			return BulkUpdateOrderStatusResult{}, fmt.Errorf("scan bulk order: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return BulkUpdateOrderStatusResult{}, fmt.Errorf("iterate bulk orders: %w", err)
	}

	result.NotFoundCount = result.RequestedCount - len(items)
	previousStatuses := make(map[string]struct{}, len(items))
	for _, item := range items {
		previousStatuses[item.PreviousStatus] = struct{}{}
	}
	if len(previousStatuses) > 1 {
		return BulkUpdateOrderStatusResult{}, ErrBulkOrderStatusMismatch
	}

	for _, item := range items {
		if item.PreviousStatus == input.OrderStatus {
			result.SkippedCount++
			continue
		}

		if _, err := tx.Exec(ctx, `
			UPDATE orders
			SET order_status = $1
			WHERE id = $2
		`, input.OrderStatus, item.ID); err != nil {
			return BulkUpdateOrderStatusResult{}, fmt.Errorf("bulk update order status: %w", err)
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO order_status_logs (order_id, previous_status, new_status, changed_by, notes)
			VALUES ($1, $2, $3, $4, $5)
		`, item.ID, item.PreviousStatus, input.OrderStatus, input.ActorID, input.Notes); err != nil {
			return BulkUpdateOrderStatusResult{}, fmt.Errorf("insert bulk status log: %w", err)
		}

		result.UpdatedCount++
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
		VALUES (
			$1,
			'BULK_UPDATE_ORDER_STATUS',
			'orders',
			'bulk',
			jsonb_build_object(
				'order_codes', to_jsonb($2::text[]),
				'new_status', $3::text,
				'updated_count', $4::int,
				'skipped_count', $5::int,
				'not_found_count', $6::int
			)
		)
	`, input.ActorID, input.OrderCodes, input.OrderStatus, result.UpdatedCount, result.SkippedCount, result.NotFoundCount); err != nil {
		return BulkUpdateOrderStatusResult{}, fmt.Errorf("insert bulk status audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return BulkUpdateOrderStatusResult{}, fmt.Errorf("commit bulk update order status: %w", err)
	}

	return result, nil
}

func (repo *Repository) upsertCustomer(ctx context.Context, tx pgx.Tx, name string, phone *string, notes *string) (int64, error) {
	if phone != nil && *phone != "" {
		var id int64
		err := tx.QueryRow(ctx, `
			SELECT id
			FROM customers
			WHERE phone = $1
			ORDER BY id
			LIMIT 1
		`, *phone).Scan(&id)
		if err == nil {
			_, err = tx.Exec(ctx, `
				UPDATE customers
				SET name = $1, notes = COALESCE($2, notes)
				WHERE id = $3
			`, name, notes, id)
			if err != nil {
				return 0, fmt.Errorf("update customer: %w", err)
			}
			return id, nil
		}
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return 0, fmt.Errorf("find customer by phone: %w", err)
		}
	}

	var customerID int64
	err := tx.QueryRow(ctx, `
		INSERT INTO customers (name, phone, notes)
		VALUES ($1, $2, $3)
		RETURNING id
	`, name, phone, notes).Scan(&customerID)
	if err != nil {
		return 0, fmt.Errorf("insert customer: %w", err)
	}

	return customerID, nil
}

func (repo *Repository) nextDailySequence(ctx context.Context, tx pgx.Tx, businessDate string, serviceCode string) (int, error) {
	var sequence int
	err := tx.QueryRow(ctx, `
		INSERT INTO daily_sequences (business_date, service_code, next_number)
		VALUES ($1, $2, 2)
		ON CONFLICT (business_date, service_code)
		DO UPDATE SET next_number = daily_sequences.next_number + 1
		RETURNING next_number - 1
	`, businessDate, serviceCode).Scan(&sequence)
	if err != nil {
		return 0, fmt.Errorf("next daily sequence: %w", err)
	}

	return sequence, nil
}

func (repo *Repository) UpdateOrder(ctx context.Context, orderCode string, input UpdateOrderInput) (Order, error) {
	tx, err := repo.db.Begin(ctx)
	if err != nil {
		return Order{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var current struct {
		ID            int64
		PaidAmount    int64
		OrderStatus   string
		PaymentStatus string
	}
	err = tx.QueryRow(ctx, `
		SELECT id, paid_amount, order_status, payment_status
		FROM orders
		WHERE order_code = $1
		FOR UPDATE
	`, orderCode).Scan(
		&current.ID,
		&current.PaidAmount,
		&current.OrderStatus,
		&current.PaymentStatus,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Order{}, ErrOrderNotFound
	}
	if err != nil {
		return Order{}, fmt.Errorf("find order for update: %w", err)
	}

	if current.OrderStatus != "MENUNGGU" && current.OrderStatus != "DIPROSES" {
		return Order{}, ErrOrderNotEditable
	}

	var serviceID int16
	var pricePerKg int64
	err = tx.QueryRow(ctx, `
		SELECT id, price_per_kg
		FROM services
		WHERE code = $1 AND is_active = true
	`, strings.ToUpper(input.ServiceCode)).Scan(&serviceID, &pricePerKg)
	if errors.Is(err, pgx.ErrNoRows) {
		return Order{}, errors.New("layanan tidak ditemukan")
	}
	if err != nil {
		return Order{}, fmt.Errorf("find service for update: %w", err)
	}

	weightKg := float64(input.WeightGrams) / 1000.0
	if weightKg <= 0 {
		return Order{}, errors.New("berat harus lebih besar dari 0")
	}

	totalAmount := int64(math.Round(weightKg * float64(pricePerKg)))

	paymentStatus := "BELUM_BAYAR"
	if current.PaidAmount >= totalAmount {
		paymentStatus = "LUNAS"
	} else if current.PaidAmount > 0 {
		paymentStatus = "DP"
	}

	customerID, err := repo.upsertCustomer(ctx, tx, input.CustomerName, input.CustomerPhone, nil)
	if err != nil {
		return Order{}, fmt.Errorf("upsert customer: %w", err)
	}

	_, err = tx.Exec(ctx, `
		UPDATE orders
		SET customer_id = $2, service_id = $3, weight_kg = $4, total_amount = $5, payment_status = $6, roast_level = $7, grind_level = $8, notes = $9
		WHERE id = $1
	`, current.ID, customerID, serviceID, weightKg, totalAmount, paymentStatus, input.RoastLevel, input.GrindLevel, input.Notes)
	if err != nil {
		return Order{}, fmt.Errorf("update order: %w", err)
	}

	if input.ActorID > 0 {
		payload := fmt.Sprintf(`{"order_code":"%s","weight_kg":%f,"total_amount":%d}`, orderCode, weightKg, totalAmount)
		_, _ = tx.Exec(ctx, `
			INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
			VALUES ($1, 'UPDATE_ORDER', 'orders', $2, $3::jsonb)
		`, input.ActorID, fmt.Sprintf("%d", current.ID), payload)
	}

	if err := tx.Commit(ctx); err != nil {
		return Order{}, fmt.Errorf("commit update order tx: %w", err)
	}

	return repo.FindByCode(ctx, orderCode)
}
