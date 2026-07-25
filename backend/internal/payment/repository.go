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

	rows, err := repo.db.Query(ctx, `
		SELECT p.id, p.order_id, o.order_code, c.name, p.payment_type, p.amount,
			p.payment_method, p.received_by, u.name, p.paid_at, p.notes,
			o.total_amount, o.paid_amount, (o.total_amount - o.paid_amount),
			o.payment_status, o.order_status, count(*) OVER() AS total_count
		FROM payments p
		JOIN orders o ON o.id = p.order_id
		JOIN customers c ON c.id = o.customer_id
		JOIN users u ON u.id = p.received_by
		ORDER BY p.paid_at DESC, p.id DESC
		LIMIT $1 OFFSET $2
	`, filter.Limit, filter.Offset)
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
		if err := repo.db.QueryRow(ctx, `SELECT count(*) FROM payments`).Scan(&result.Total); err != nil {
			return ListResult{}, fmt.Errorf("count payments: %w", err)
		}
	}

	return result, nil
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
