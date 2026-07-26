package customer

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrCustomerNotFound = errors.New("customer not found")

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (repo *Repository) Suggestions(ctx context.Context, search string, limit int) ([]CustomerSuggestion, error) {
	if limit <= 0 || limit > 20 {
		limit = 8
	}

	search = strings.TrimSpace(search)
	if len(search) < 2 {
		return []CustomerSuggestion{}, nil
	}

	pattern := "%" + strings.ToLower(search) + "%"
	rows, err := repo.db.Query(ctx, `
		SELECT
			c.id,
			c.name,
			c.phone,
			c.address,
			c.notes,
			c.created_at,
			count(o.id) AS total_orders,
			COALESCE(sum(o.weight_kg), 0)::text AS total_weight_kg,
			max(o.created_at) AS last_order_at
		FROM customers c
		LEFT JOIN orders o ON o.customer_id = c.id
		WHERE lower(c.name) LIKE $1 OR lower(COALESCE(c.phone, '')) LIKE $1
		GROUP BY c.id
		ORDER BY max(o.created_at) DESC NULLS LAST, c.name ASC
		LIMIT $2
	`, pattern, limit)
	if err != nil {
		return nil, fmt.Errorf("customer suggestions: %w", err)
	}
	defer rows.Close()

	items := make([]CustomerSuggestion, 0)
	for rows.Next() {
		var item CustomerSuggestion
		if err := rows.Scan(
			&item.ID,
			&item.Name,
			&item.Phone,
			&item.Address,
			&item.Notes,
			&item.CreatedAt,
			&item.TotalOrders,
			&item.TotalWeightKg,
			&item.LastOrderAt,
		); err != nil {
			return nil, fmt.Errorf("scan customer suggestion: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate customer suggestions: %w", err)
	}

	return items, nil
}

func (repo *Repository) List(ctx context.Context, filter CustomerListFilter) (CustomerListResult, error) {
	if filter.Limit <= 0 || filter.Limit > 100 {
		filter.Limit = 12
	}
	if filter.Offset < 0 {
		filter.Offset = 0
	}

	search := strings.TrimSpace(filter.Search)
	hasSearch := len(search) >= 1

	var pattern string
	if hasSearch {
		pattern = "%" + strings.ToLower(search) + "%"
	}

	// Count query
	countQuery := `
		SELECT count(*) FROM customers c
	`
	var countArgs []any
	if hasSearch {
		countQuery += ` WHERE lower(c.name) LIKE $1 OR lower(COALESCE(c.phone, '')) LIKE $1`
		countArgs = append(countArgs, pattern)
	}

	var total int64
	if err := repo.db.QueryRow(ctx, countQuery, countArgs...).Scan(&total); err != nil {
		return CustomerListResult{}, fmt.Errorf("count customers: %w", err)
	}

	if total == 0 {
		return CustomerListResult{Items: []Customer{}, Total: 0}, nil
	}

	// List query
	listQuery := `
		SELECT
			c.id,
			c.name,
			c.phone,
			c.address,
			c.notes,
			c.created_at,
			count(o.id) AS total_orders,
			COALESCE(sum(o.weight_kg), 0)::text AS total_weight_kg,
			COALESCE(sum(o.total_amount), 0) AS total_spent,
			COALESCE(sum(CASE WHEN o.order_status NOT IN ('SELESAI', 'DIBATALKAN') THEN o.total_amount - o.paid_amount ELSE 0 END), 0) AS receivable,
			max(o.created_at) AS last_order_at
		FROM customers c
		LEFT JOIN orders o ON o.customer_id = c.id
	`
	var listArgs []any
	argIndex := 1

	if hasSearch {
		listQuery += fmt.Sprintf(` WHERE lower(c.name) LIKE $%d OR lower(COALESCE(c.phone, '')) LIKE $%d`, argIndex, argIndex)
		listArgs = append(listArgs, pattern)
		argIndex++
	}

	listQuery += ` GROUP BY c.id`
	listQuery += ` ORDER BY max(o.created_at) DESC NULLS LAST, c.name ASC`
	listQuery += fmt.Sprintf(` LIMIT $%d OFFSET $%d`, argIndex, argIndex+1)
	listArgs = append(listArgs, filter.Limit, filter.Offset)

	rows, err := repo.db.Query(ctx, listQuery, listArgs...)
	if err != nil {
		return CustomerListResult{}, fmt.Errorf("list customers: %w", err)
	}
	defer rows.Close()

	items := make([]Customer, 0)
	for rows.Next() {
		var item Customer
		if err := rows.Scan(
			&item.ID,
			&item.Name,
			&item.Phone,
			&item.Address,
			&item.Notes,
			&item.CreatedAt,
			&item.TotalOrders,
			&item.TotalWeightKg,
			&item.TotalSpent,
			&item.Receivable,
			&item.LastOrderAt,
		); err != nil {
			return CustomerListResult{}, fmt.Errorf("scan customer: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return CustomerListResult{}, fmt.Errorf("iterate customers: %w", err)
	}

	return CustomerListResult{Items: items, Total: total}, nil
}

func (repo *Repository) FindByID(ctx context.Context, id int64) (Customer, error) {
	var item Customer
	err := repo.db.QueryRow(ctx, `
		SELECT
			c.id,
			c.name,
			c.phone,
			c.address,
			c.notes,
			c.created_at,
			count(o.id) AS total_orders,
			COALESCE(sum(o.weight_kg), 0)::text AS total_weight_kg,
			COALESCE(sum(o.total_amount), 0) AS total_spent,
			COALESCE(sum(CASE WHEN o.order_status NOT IN ('SELESAI', 'DIBATALKAN') THEN o.total_amount - o.paid_amount ELSE 0 END), 0) AS receivable,
			max(o.created_at) AS last_order_at
		FROM customers c
		LEFT JOIN orders o ON o.customer_id = c.id
		WHERE c.id = $1
		GROUP BY c.id
	`, id).Scan(
		&item.ID,
		&item.Name,
		&item.Phone,
		&item.Address,
		&item.Notes,
		&item.CreatedAt,
		&item.TotalOrders,
		&item.TotalWeightKg,
		&item.TotalSpent,
		&item.Receivable,
		&item.LastOrderAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Customer{}, ErrCustomerNotFound
	}
	if err != nil {
		return Customer{}, fmt.Errorf("find customer by id: %w", err)
	}

	return item, nil
}

func (repo *Repository) OrdersByCustomerID(ctx context.Context, customerID int64, limit int, offset int) ([]CustomerOrder, int64, error) {
	if limit <= 0 || limit > 100 {
		limit = 10
	}
	if offset < 0 {
		offset = 0
	}

	var total int64
	if err := repo.db.QueryRow(ctx,
		`SELECT count(*) FROM orders WHERE customer_id = $1`, customerID,
	).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count customer orders: %w", err)
	}

	if total == 0 {
		return []CustomerOrder{}, 0, nil
	}

	rows, err := repo.db.Query(ctx, `
		SELECT
			o.id,
			o.order_code,
			s.code AS service_code,
			s.name AS service_name,
			o.weight_kg::text AS weight_kg,
			o.total_amount,
			o.paid_amount,
			o.payment_status,
			o.order_status,
			o.created_at
		FROM orders o
		JOIN services s ON s.id = o.service_id
		WHERE o.customer_id = $1
		ORDER BY o.created_at DESC
		LIMIT $2 OFFSET $3
	`, customerID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("list customer orders: %w", err)
	}
	defer rows.Close()

	items := make([]CustomerOrder, 0)
	for rows.Next() {
		var item CustomerOrder
		if err := rows.Scan(
			&item.ID,
			&item.OrderCode,
			&item.ServiceCode,
			&item.ServiceName,
			&item.WeightKg,
			&item.TotalAmount,
			&item.PaidAmount,
			&item.PaymentStatus,
			&item.OrderStatus,
			&item.CreatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan customer order: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate customer orders: %w", err)
	}

	return items, total, nil
}

func (repo *Repository) Update(ctx context.Context, id int64, input UpdateCustomerInput) (Customer, error) {
	tag, err := repo.db.Exec(ctx, `
		UPDATE customers
		SET name = $2, phone = $3, address = $4, notes = $5
		WHERE id = $1
	`, id, input.Name, input.Phone, input.Address, input.Notes)
	if err != nil {
		return Customer{}, fmt.Errorf("update customer: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return Customer{}, ErrCustomerNotFound
	}

	return repo.FindByID(ctx, id)
}

