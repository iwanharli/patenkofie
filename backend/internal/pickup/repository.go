package pickup

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrOrderNotFound = errors.New("order not found")
	ErrPickupExists  = errors.New("pickup already exists")
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (repo *Repository) FindByOrderCode(ctx context.Context, orderCode string) (Pickup, error) {
	var item Pickup
	err := repo.db.QueryRow(ctx, `
		SELECT
			p.id,
			p.order_id,
			o.order_code,
			p.recipient_name,
			p.recipient_type,
			p.recipient_phone,
			p.photo_path,
			p.handed_over_by,
			u.name,
			p.picked_up_at,
			p.notes
		FROM pickups p
		JOIN orders o ON o.id = p.order_id
		JOIN users u ON u.id = p.handed_over_by
		WHERE o.order_code = $1
	`, orderCode).Scan(
		&item.ID,
		&item.OrderID,
		&item.OrderCode,
		&item.RecipientName,
		&item.RecipientType,
		&item.RecipientPhone,
		&item.PhotoPath,
		&item.HandedOverBy,
		&item.HandedOverName,
		&item.PickedUpAt,
		&item.Notes,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Pickup{}, ErrOrderNotFound
	}
	if err != nil {
		return Pickup{}, fmt.Errorf("find pickup by order code: %w", err)
	}

	return item, nil
}

func (repo *Repository) Create(ctx context.Context, input CreatePickupInput) (Pickup, error) {
	tx, err := repo.db.Begin(ctx)
	if err != nil {
		return Pickup{}, fmt.Errorf("begin create pickup: %w", err)
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
	`, input.OrderCode).Scan(&orderID, &previousStatus)
	if errors.Is(err, pgx.ErrNoRows) {
		return Pickup{}, ErrOrderNotFound
	}
	if err != nil {
		return Pickup{}, fmt.Errorf("find order for pickup: %w", err)
	}

	var existingID int64
	err = tx.QueryRow(ctx, `SELECT id FROM pickups WHERE order_id = $1`, orderID).Scan(&existingID)
	if err == nil {
		return Pickup{}, ErrPickupExists
	}
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return Pickup{}, fmt.Errorf("find existing pickup: %w", err)
	}

	var item Pickup
	err = tx.QueryRow(ctx, `
		INSERT INTO pickups (
			order_id, recipient_name, recipient_type, recipient_phone,
			photo_path, handed_over_by, notes
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, order_id, recipient_name, recipient_type, recipient_phone,
			photo_path, handed_over_by, picked_up_at, notes
	`, orderID, input.RecipientName, input.RecipientType, input.RecipientPhone, input.PhotoPath, input.HandedOverBy, input.Notes).Scan(
		&item.ID,
		&item.OrderID,
		&item.RecipientName,
		&item.RecipientType,
		&item.RecipientPhone,
		&item.PhotoPath,
		&item.HandedOverBy,
		&item.PickedUpAt,
		&item.Notes,
	)
	if err != nil {
		return Pickup{}, fmt.Errorf("insert pickup: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE orders
		SET order_status = 'SELESAI'
		WHERE id = $1
	`, orderID); err != nil {
		return Pickup{}, fmt.Errorf("update order complete: %w", err)
	}

	if previousStatus != "SELESAI" {
		if _, err := tx.Exec(ctx, `
			INSERT INTO order_status_logs (order_id, previous_status, new_status, changed_by, notes)
			VALUES ($1, $2, 'SELESAI', $3, $4)
		`, orderID, previousStatus, input.HandedOverBy, input.Notes); err != nil {
			return Pickup{}, fmt.Errorf("insert pickup status log: %w", err)
		}
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
		VALUES (
			$1,
			'CREATE_PICKUP',
			'pickups',
			$2,
			jsonb_build_object('order_code', $3::text, 'photo_path', $4::text)
		)
	`, input.HandedOverBy, fmt.Sprint(item.ID), input.OrderCode, input.PhotoPath); err != nil {
		return Pickup{}, fmt.Errorf("insert pickup audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return Pickup{}, fmt.Errorf("commit create pickup: %w", err)
	}

	item.OrderCode = input.OrderCode
	return repo.FindByOrderCode(ctx, input.OrderCode)
}
