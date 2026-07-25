package customer

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

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
