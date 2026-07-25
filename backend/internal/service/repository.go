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
		SELECT s.id, s.code, s.name, s.price_per_kg, s.is_active, u.name, s.updated_at
		FROM services s
		LEFT JOIN users u ON u.id = s.updated_by
		WHERE s.code = $1
	`, code).Scan(
		&item.ID,
		&item.Code,
		&item.Name,
		&item.PricePerKg,
		&item.IsActive,
		&item.UpdatedByName,
		&item.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Service{}, ErrServiceNotFound
	}
	if err != nil {
		return Service{}, fmt.Errorf("find service by code: %w", err)
	}

	return item, nil
}
