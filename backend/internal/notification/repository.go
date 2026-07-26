package notification

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (repo *Repository) ListByUserID(ctx context.Context, userID int64, limit int) ([]Notification, error) {
	rows, err := repo.db.Query(ctx, `
		SELECT id, user_id, type, title, message, is_read, created_at
		FROM notifications
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("query notifications: %w", err)
	}
	defer rows.Close()

	var notifications []Notification
	for rows.Next() {
		var n Notification
		if err := rows.Scan(&n.ID, &n.UserID, &n.Type, &n.Title, &n.Message, &n.IsRead, &n.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan notification: %w", err)
		}
		notifications = append(notifications, n)
	}

	return notifications, nil
}

func (repo *Repository) MarkAllAsRead(ctx context.Context, userID int64) error {
	_, err := repo.db.Exec(ctx, `
		UPDATE notifications
		SET is_read = true
		WHERE user_id = $1 AND is_read = false
	`, userID)
	if err != nil {
		return fmt.Errorf("mark all as read: %w", err)
	}
	return nil
}

func (repo *Repository) Create(ctx context.Context, userID int64, notifType, title, message string) error {
	_, err := repo.db.Exec(ctx, `
		INSERT INTO notifications (user_id, type, title, message)
		VALUES ($1, $2, $3, $4)
	`, userID, notifType, title, message)
	if err != nil {
		return fmt.Errorf("create notification: %w", err)
	}
	return nil
}
