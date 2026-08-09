package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrServiceNotFound = errors.New("service not found")

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (repo *Repository) List(ctx context.Context) ([]Service, error) {
	rows, err := repo.db.Query(ctx, `
		SELECT s.id, s.code, s.name, s.price_per_kg, s.is_active, u.name, s.updated_at
		FROM services s
		LEFT JOIN users u ON u.id = s.updated_by
		ORDER BY s.id
	`)
	if err != nil {
		return nil, fmt.Errorf("list services: %w", err)
	}
	defer rows.Close()

	services := make([]Service, 0)
	for rows.Next() {
		var item Service
		if err := rows.Scan(
			&item.ID,
			&item.Code,
			&item.Name,
			&item.PricePerKg,
			&item.IsActive,
			&item.UpdatedByName,
			&item.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan service: %w", err)
		}
		services = append(services, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate services: %w", err)
	}

	return services, nil
}

func (repo *Repository) FindByCode(ctx context.Context, code string) (Service, error) {
	var item Service
	err := repo.db.QueryRow(ctx, `
		SELECT 
			s.id, s.code, s.name, s.price_per_kg, s.is_active, u.name, s.updated_at,
			COUNT(o.id) AS today_orders,
			COALESCE(SUM(o.weight_kg), 0) AS today_weight,
			COALESCE(SUM(o.total_amount), 0) AS today_revenue
		FROM services s
		LEFT JOIN users u ON u.id = s.updated_by
		LEFT JOIN orders o ON o.service_id = s.id AND o.created_at::DATE = CURRENT_DATE
		WHERE s.code = $1
		GROUP BY s.id, u.id
	`, code).Scan(
		&item.ID,
		&item.Code,
		&item.Name,
		&item.PricePerKg,
		&item.IsActive,
		&item.UpdatedByName,
		&item.UpdatedAt,
		&item.TodayOrders,
		&item.TodayWeight,
		&item.TodayRevenue,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Service{}, ErrServiceNotFound
	}
	if err != nil {
		return Service{}, fmt.Errorf("find service by code: %w", err)
	}

	return item, nil
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

func (repo *Repository) Update(ctx context.Context, code string, pricePerKg int64, isActive bool, updatedBy int64) error {
	cmd, err := repo.db.Exec(ctx, `
		UPDATE services
		SET price_per_kg = $1, is_active = $2, updated_by = $3
		WHERE code = $4
	`, pricePerKg, isActive, updatedBy, code)
	if err != nil {
		return fmt.Errorf("update service: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return ErrServiceNotFound
	}
	return nil
}
