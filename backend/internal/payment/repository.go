package payment

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrOrderAlreadyPaid = errors.New("order already paid")
	ErrOrderNotFound    = errors.New("order not found")
	ErrPaymentNotFound  = errors.New("payment not found")
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (repo *Repository) List(ctx context.Context, filter ListFilter, now time.Time) (ListResult, error) {
	location, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		location = now.Location()
	}
	localNow := now.In(location)
	startOfDay := time.Date(localNow.Year(), localNow.Month(), localNow.Day(), 0, 0, 0, 0, location)
	endOfDay := startOfDay.Add(24 * time.Hour)

	summary, err := repo.summary(ctx, startOfDay, endOfDay)
	if err != nil {
		return ListResult{}, err
	}

	whereClauses := []string{"1 = 1"}
	args := []any{}

	if filter.Search != "" {
		args = append(args, "%"+strings.ToLower(filter.Search)+"%")
		whereClauses = append(whereClauses, fmt.Sprintf(
			"(lower(COALESCE(payment_code, '')) LIKE $%d OR lower(order_code) LIKE $%d OR lower(customer_name) LIKE $%d)",
			len(args), len(args), len(args),
		))
	}
	if filter.RowType != "" {
		args = append(args, filter.RowType)
		whereClauses = append(whereClauses, fmt.Sprintf("row_type = $%d", len(args)))
	}
	if filter.PaymentType != "" {
		args = append(args, filter.PaymentType)
		whereClauses = append(whereClauses, fmt.Sprintf("payment_type = $%d", len(args)))
	}
	if filter.PaymentStatus != "" {
		args = append(args, filter.PaymentStatus)
		whereClauses = append(whereClauses, fmt.Sprintf("payment_status = $%d", len(args)))
	}
	if filter.OrderStatus != "" {
		args = append(args, filter.OrderStatus)
		whereClauses = append(whereClauses, fmt.Sprintf("order_status = $%d", len(args)))
	}

	orderBy := paymentListSortClause(filter.SortBy, filter.SortDirection)
	args = append(args, filter.Limit, filter.Offset)
	limitParam := len(args) - 1
	offsetParam := len(args)

	query := fmt.Sprintf(`
		WITH list_items AS (
			SELECT
				'PAYMENT'::text AS row_type,
				p.id,
				('PAY-' || lpad(p.id::text, 6, '0'))::text AS payment_code,
				p.order_id,
				o.order_code,
				c.name AS customer_name,
				p.payment_type,
				p.amount,
				p.payment_method,
				p.received_by,
				u.name AS received_by_name,
				p.paid_at,
				p.notes,
				o.total_amount,
				o.paid_amount,
				(o.total_amount - o.paid_amount) AS order_remaining,
				o.payment_status,
				o.order_status,
				p.amount AS sort_amount,
				p.paid_at AS sort_time
			FROM payments p
			JOIN orders o ON o.id = p.order_id
			JOIN customers c ON c.id = o.customer_id
			JOIN users u ON u.id = p.received_by

			UNION ALL

			SELECT
				'UNPAID_ORDER'::text AS row_type,
				o.id,
				NULL::text AS payment_code,
				o.id AS order_id,
				o.order_code,
				c.name AS customer_name,
				'UNPAID_ORDER'::text AS payment_type,
				0::bigint AS amount,
				''::text AS payment_method,
				0::bigint AS received_by,
				''::text AS received_by_name,
				o.created_at AS paid_at,
				o.notes,
				o.total_amount,
				o.paid_amount,
				(o.total_amount - o.paid_amount) AS order_remaining,
				o.payment_status,
				o.order_status,
				(o.total_amount - o.paid_amount) AS sort_amount,
				o.created_at AS sort_time
			FROM orders o
			JOIN customers c ON c.id = o.customer_id
			WHERE o.payment_status = 'BELUM_BAYAR'
				AND o.order_status NOT IN ('SELESAI', 'DIBATALKAN')
				AND o.total_amount > o.paid_amount
		)
		SELECT row_type, id, order_id, order_code, customer_name, payment_type, amount,
			payment_method, received_by, received_by_name, paid_at, notes,
			total_amount, paid_amount, order_remaining, payment_status, order_status,
			count(*) OVER() AS total_count
		FROM list_items
		WHERE %s
		ORDER BY %s
		LIMIT $%d OFFSET $%d
	`, strings.Join(whereClauses, " AND "), orderBy, limitParam, offsetParam)

	rows, err := repo.db.Query(ctx, query, args...)
	if err != nil {
		return ListResult{}, fmt.Errorf("list payments: %w", err)
	}
	defer rows.Close()

	result := ListResult{
		Items:   []Payment{},
		Summary: summary,
	}
	for rows.Next() {
		var item Payment
		if err := scanPayment(rows, &item, &result.Total); err != nil {
			return ListResult{}, err
		}
		if item.OrderRemaining < 0 {
			item.OrderRemaining = 0
		}
		result.Items = append(result.Items, item)
	}
	if err := rows.Err(); err != nil {
		return ListResult{}, fmt.Errorf("iterate payments: %w", err)
	}

	if len(result.Items) == 0 {
		countQuery := fmt.Sprintf(`
			WITH list_items AS (
				SELECT
					'PAYMENT'::text AS row_type,
					p.id,
					('PAY-' || lpad(p.id::text, 6, '0'))::text AS payment_code,
					o.order_code,
					c.name AS customer_name,
					p.payment_type,
					o.payment_status,
					o.order_status
				FROM payments p
				JOIN orders o ON o.id = p.order_id
				JOIN customers c ON c.id = o.customer_id

				UNION ALL

				SELECT
					'UNPAID_ORDER'::text AS row_type,
					o.id,
					NULL::text AS payment_code,
					o.order_code,
					c.name AS customer_name,
					'UNPAID_ORDER'::text AS payment_type,
					o.payment_status,
					o.order_status
				FROM orders o
				JOIN customers c ON c.id = o.customer_id
				WHERE o.payment_status = 'BELUM_BAYAR'
					AND o.order_status NOT IN ('SELESAI', 'DIBATALKAN')
					AND o.total_amount > o.paid_amount
			)
			SELECT count(*)
			FROM list_items
			WHERE %s
		`, strings.Join(whereClauses, " AND "))
		if err := repo.db.QueryRow(ctx, countQuery, args[:len(args)-2]...).Scan(&result.Total); err != nil {
			return ListResult{}, fmt.Errorf("count payments: %w", err)
		}
	}

	return result, nil
}

func paymentListSortClause(sortBy string, direction string) string {
	direction = strings.ToUpper(strings.TrimSpace(direction))
	if direction != "ASC" {
		direction = "DESC"
	}

	switch strings.ToLower(strings.TrimSpace(sortBy)) {
	case "amount":
		return "sort_amount " + direction + ", sort_time DESC, id DESC"
	case "code":
		return "COALESCE(payment_code, order_code) " + direction + ", id DESC"
	case "customer":
		return "customer_name " + direction + ", sort_time DESC, id DESC"
	case "order":
		return "order_code " + direction + ", id DESC"
	case "payment_status":
		return "payment_status " + direction + ", sort_time DESC, id DESC"
	case "status":
		return "order_status " + direction + ", sort_time DESC, id DESC"
	case "type":
		return "payment_type " + direction + ", sort_time DESC, id DESC"
	default:
		return "sort_time " + direction + ", id " + direction
	}
}

func (repo *Repository) FindByCode(ctx context.Context, code string) (Payment, error) {
	id, err := paymentIDFromCode(code)
	if err != nil {
		return Payment{}, ErrPaymentNotFound
	}

	item, err := repo.findByID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Payment{}, ErrPaymentNotFound
	}
	if err != nil {
		return Payment{}, err
	}

	return item, nil
}

func (repo *Repository) SettleOrder(ctx context.Context, orderCode string, input SettleOrderInput) (Payment, error) {
	tx, err := repo.db.Begin(ctx)
	if err != nil {
		return Payment{}, fmt.Errorf("begin settle payment: %w", err)
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	var orderID int64
	var totalAmount int64
	var paidAmount int64
	err = tx.QueryRow(ctx, `
		SELECT id, total_amount, paid_amount
		FROM orders
		WHERE order_code = $1
		FOR UPDATE
	`, orderCode).Scan(&orderID, &totalAmount, &paidAmount)
	if errors.Is(err, pgx.ErrNoRows) {
		return Payment{}, ErrOrderNotFound
	}
	if err != nil {
		return Payment{}, fmt.Errorf("find order for payment: %w", err)
	}

	remaining := totalAmount - paidAmount
	if remaining <= 0 {
		return Payment{}, ErrOrderAlreadyPaid
	}

	paymentType := "REMAINING_PAYMENT"
	if paidAmount == 0 {
		paymentType = "FULL_PAYMENT"
	}
	notes := input.Notes
	if notes == nil {
		defaultNotes := "Pelunasan transaksi"
		notes = &defaultNotes
	}

	var paymentID int64
	err = tx.QueryRow(ctx, `
		INSERT INTO payments (order_id, payment_type, amount, received_by, notes)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, orderID, paymentType, remaining, input.ActorID, notes).Scan(&paymentID)
	if err != nil {
		return Payment{}, fmt.Errorf("insert settlement payment: %w", err)
	}

	_, err = tx.Exec(ctx, `
		UPDATE orders
		SET paid_amount = total_amount,
			payment_status = 'LUNAS'
		WHERE id = $1
	`, orderID)
	if err != nil {
		return Payment{}, fmt.Errorf("update order payment status: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
		VALUES (
			$1,
			'SETTLE_PAYMENT',
			'payments',
			$2,
			jsonb_build_object(
				'order_code', $3::text,
				'amount', $4::bigint,
				'payment_code', $5::text
			)
		)
	`, input.ActorID, fmt.Sprint(paymentID), orderCode, remaining, PaymentCode(paymentID))
	if err != nil {
		return Payment{}, fmt.Errorf("insert settlement audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return Payment{}, fmt.Errorf("commit settle payment: %w", err)
	}

	return repo.findByID(ctx, paymentID)
}

func (repo *Repository) summary(ctx context.Context, startOfDay time.Time, endOfDay time.Time) (Summary, error) {
	var item Summary
	if err := repo.db.QueryRow(ctx, `
		WITH today_payments AS (
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
			(SELECT COALESCE(sum(amount), 0) FROM today_payments),
			(SELECT count(*) FROM today_payments),
			(SELECT COALESCE(sum(remaining), 0) FROM active_outstanding),
			(SELECT count(*) FROM active_outstanding),
			(SELECT count(*) FROM payments)
	`, startOfDay, endOfDay).Scan(
		&item.CashToday,
		&item.PaymentsToday,
		&item.OutstandingTotal,
		&item.OutstandingCount,
		&item.TotalPayments,
	); err != nil {
		return Summary{}, fmt.Errorf("payment summary: %w", err)
	}

	return item, nil
}

func (repo *Repository) findByID(ctx context.Context, id int64) (Payment, error) {
	var item Payment
	err := repo.db.QueryRow(ctx, `
		SELECT p.id, p.order_id, o.order_code, c.name, p.payment_type, p.amount,
			p.payment_method, p.received_by, u.name, p.paid_at, p.notes,
			o.total_amount, o.paid_amount, (o.total_amount - o.paid_amount),
			o.payment_status, o.order_status
		FROM payments p
		JOIN orders o ON o.id = p.order_id
		JOIN customers c ON c.id = o.customer_id
		JOIN users u ON u.id = p.received_by
		WHERE p.id = $1
	`, id).Scan(
		&item.ID,
		&item.OrderID,
		&item.OrderCode,
		&item.CustomerName,
		&item.PaymentType,
		&item.Amount,
		&item.PaymentMethod,
		&item.ReceivedBy,
		&item.ReceivedByName,
		&item.PaidAt,
		&item.Notes,
		&item.OrderTotal,
		&item.OrderPaid,
		&item.OrderRemaining,
		&item.OrderPayStatus,
		&item.OrderStatus,
	)
	if err != nil {
		return Payment{}, fmt.Errorf("find payment by id: %w", err)
	}
	item.RowType = "PAYMENT"
	if item.OrderRemaining < 0 {
		item.OrderRemaining = 0
	}

	return item, nil
}

func PaymentCode(id int64) string {
	return fmt.Sprintf("PAY-%06d", id)
}

func paymentIDFromCode(code string) (int64, error) {
	normalized := strings.TrimSpace(strings.ToUpper(code))
	normalized = strings.TrimPrefix(normalized, "PAY-")

	id, err := strconv.ParseInt(normalized, 10, 64)
	if err != nil || id <= 0 {
		return 0, fmt.Errorf("invalid payment code")
	}

	return id, nil
}

type paymentScanner interface {
	Scan(dest ...any) error
}

func scanPayment(row paymentScanner, item *Payment, total *int64) error {
	err := row.Scan(
		&item.RowType,
		&item.ID,
		&item.OrderID,
		&item.OrderCode,
		&item.CustomerName,
		&item.PaymentType,
		&item.Amount,
		&item.PaymentMethod,
		&item.ReceivedBy,
		&item.ReceivedByName,
		&item.PaidAt,
		&item.Notes,
		&item.OrderTotal,
		&item.OrderPaid,
		&item.OrderRemaining,
		&item.OrderPayStatus,
		&item.OrderStatus,
		total,
	)
	if err != nil {
		return fmt.Errorf("scan payment: %w", err)
	}

	return nil
}

func (repo *Repository) IsOwner(ctx context.Context, userID int64) (bool, error) {
	var role string
	err := repo.db.QueryRow(ctx, `
		SELECT role
		FROM users
		WHERE id = $1 AND is_active = true
	`, userID).Scan(&role)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("find user role: %w", err)
	}

	return role == "OWNER", nil
}

func (repo *Repository) VoidPayment(ctx context.Context, code string, actorID int64) (Payment, error) {
	id, err := paymentIDFromCode(code)
	if err != nil {
		return Payment{}, ErrPaymentNotFound
	}

	tx, err := repo.db.Begin(ctx)
	if err != nil {
		return Payment{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var p struct {
		ID        int64
		OrderID   int64
		Amount    int64
		PaidAt    time.Time
		Notes     *string
		OrderCode string
	}
	err = tx.QueryRow(ctx, `
		SELECT p.id, p.order_id, p.amount, p.paid_at, p.notes, o.order_code
		FROM payments p
		JOIN orders o ON o.id = p.order_id
		WHERE p.id = $1
		FOR UPDATE OF p
	`, id).Scan(&p.ID, &p.OrderID, &p.Amount, &p.PaidAt, &p.Notes, &p.OrderCode)
	if errors.Is(err, pgx.ErrNoRows) {
		return Payment{}, ErrPaymentNotFound
	}
	if err != nil {
		return Payment{}, fmt.Errorf("find payment for void: %w", err)
	}

	existingPayment, err := repo.findByID(ctx, id)
	if err != nil {
		return Payment{}, fmt.Errorf("find payment details: %w", err)
	}

	var order struct {
		TotalAmount int64
		PaidAmount  int64
	}
	err = tx.QueryRow(ctx, `
		SELECT total_amount, paid_amount
		FROM orders
		WHERE id = $1
		FOR UPDATE
	`, p.OrderID).Scan(&order.TotalAmount, &order.PaidAmount)
	if err != nil {
		return Payment{}, fmt.Errorf("find order for void payment: %w", err)
	}

	newPaidAmount := order.PaidAmount - p.Amount
	if newPaidAmount < 0 {
		newPaidAmount = 0
	}

	newPaymentStatus := "BELUM_BAYAR"
	if newPaidAmount >= order.TotalAmount {
		newPaymentStatus = "LUNAS"
	} else if newPaidAmount > 0 {
		newPaymentStatus = "DP"
	}

	_, err = tx.Exec(ctx, `
		UPDATE orders
		SET paid_amount = $2, payment_status = $3
		WHERE id = $1
	`, p.OrderID, newPaidAmount, newPaymentStatus)
	if err != nil {
		return Payment{}, fmt.Errorf("update order paid amount: %w", err)
	}

	_, err = tx.Exec(ctx, `DELETE FROM payments WHERE id = $1`, p.ID)
	if err != nil {
		return Payment{}, fmt.Errorf("delete payment record: %w", err)
	}

	if actorID > 0 {
		payload := fmt.Sprintf(`{"payment_code":"PAY-%06d","order_code":"%s","amount":%d}`, p.ID, p.OrderCode, p.Amount)
		_, _ = tx.Exec(ctx, `
			INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
			VALUES ($1, 'VOID_PAYMENT', 'payments', $2, $3::jsonb)
		`, actorID, fmt.Sprintf("%d", p.ID), payload)
	}

	if err := tx.Commit(ctx); err != nil {
		return Payment{}, fmt.Errorf("commit void payment tx: %w", err)
	}

	return existingPayment, nil
}

func (repo *Repository) UpdatePayment(ctx context.Context, code string, input UpdatePaymentInput) (Payment, error) {
	id, err := paymentIDFromCode(code)
	if err != nil {
		return Payment{}, ErrPaymentNotFound
	}

	if input.Amount <= 0 {
		return Payment{}, errors.New("nominal pembayaran harus lebih besar dari 0")
	}

	tx, err := repo.db.Begin(ctx)
	if err != nil {
		return Payment{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var p struct {
		ID        int64
		OrderID   int64
		OldAmount int64
		OrderCode string
	}
	err = tx.QueryRow(ctx, `
		SELECT p.id, p.order_id, p.amount, o.order_code
		FROM payments p
		JOIN orders o ON o.id = p.order_id
		WHERE p.id = $1
		FOR UPDATE OF p
	`, id).Scan(&p.ID, &p.OrderID, &p.OldAmount, &p.OrderCode)
	if errors.Is(err, pgx.ErrNoRows) {
		return Payment{}, ErrPaymentNotFound
	}
	if err != nil {
		return Payment{}, fmt.Errorf("find payment for update: %w", err)
	}

	var order struct {
		TotalAmount int64
		PaidAmount  int64
	}
	err = tx.QueryRow(ctx, `
		SELECT total_amount, paid_amount
		FROM orders
		WHERE id = $1
		FOR UPDATE
	`, p.OrderID).Scan(&order.TotalAmount, &order.PaidAmount)
	if err != nil {
		return Payment{}, fmt.Errorf("find order for payment update: %w", err)
	}

	diff := input.Amount - p.OldAmount
	newPaidAmount := order.PaidAmount + diff
	if newPaidAmount < 0 {
		newPaidAmount = 0
	}

	newPaymentStatus := "BELUM_BAYAR"
	if newPaidAmount >= order.TotalAmount {
		newPaymentStatus = "LUNAS"
	} else if newPaidAmount > 0 {
		newPaymentStatus = "DP"
	}

	_, err = tx.Exec(ctx, `
		UPDATE orders
		SET paid_amount = $2, payment_status = $3
		WHERE id = $1
	`, p.OrderID, newPaidAmount, newPaymentStatus)
	if err != nil {
		return Payment{}, fmt.Errorf("update order paid amount: %w", err)
	}

	_, err = tx.Exec(ctx, `
		UPDATE payments
		SET amount = $2, notes = $3
		WHERE id = $1
	`, p.ID, input.Amount, input.Notes)
	if err != nil {
		return Payment{}, fmt.Errorf("update payment record: %w", err)
	}

	if input.ActorID > 0 {
		payload := fmt.Sprintf(`{"payment_code":"PAY-%06d","order_code":"%s","old_amount":%d,"new_amount":%d}`, p.ID, p.OrderCode, p.OldAmount, input.Amount)
		_, _ = tx.Exec(ctx, `
			INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
			VALUES ($1, 'UPDATE_PAYMENT', 'payments', $2, $3::jsonb)
		`, input.ActorID, fmt.Sprintf("%d", p.ID), payload)
	}

	if err := tx.Commit(ctx); err != nil {
		return Payment{}, fmt.Errorf("commit update payment tx: %w", err)
	}

	return repo.findByID(ctx, id)
}

