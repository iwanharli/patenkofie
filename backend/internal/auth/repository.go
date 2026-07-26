package auth

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrUserNotFound = errors.New("user not found")

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (repo *Repository) FindActiveUserByUsername(ctx context.Context, username string) (User, error) {
	var user User
	err := repo.db.QueryRow(ctx, `
		SELECT id, name, username, password_hash, role, avatar_url, is_active, notification_preferences
		FROM users
		WHERE username = $1 AND is_active = true
	`, username).Scan(
		&user.ID,
		&user.Name,
		&user.Username,
		&user.PasswordHash,
		&user.Role,
		&user.AvatarURL,
		&user.IsActive,
		&user.NotificationPreferences,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrUserNotFound
	}
	if err != nil {
		return User{}, fmt.Errorf("find user by username: %w", err)
	}

	return user, nil
}

func (repo *Repository) FindActiveUserByID(ctx context.Context, id int64) (User, error) {
	var user User
	err := repo.db.QueryRow(ctx, `
		SELECT id, name, username, password_hash, role, avatar_url, is_active, notification_preferences
		FROM users
		WHERE id = $1 AND is_active = true
	`, id).Scan(
		&user.ID,
		&user.Name,
		&user.Username,
		&user.PasswordHash,
		&user.Role,
		&user.AvatarURL,
		&user.IsActive,
		&user.NotificationPreferences,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrUserNotFound
	}
	if err != nil {
		return User{}, fmt.Errorf("find user by id: %w", err)
	}

	return user, nil
}

func (repo *Repository) InsertAuditLog(ctx context.Context, actorID int64, action string, entityType string, entityID string, metadata string) error {
	_, err := repo.db.Exec(ctx, `
		INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
		VALUES ($1, $2, $3, $4, $5::jsonb)
	`, actorID, action, entityType, entityID, metadata)
	if err != nil {
		return fmt.Errorf("insert audit log: %w", err)
	}
	return nil
}
