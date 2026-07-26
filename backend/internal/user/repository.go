package user

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrUserNotFound      = errors.New("user not found")
	ErrUsernameDuplicate = errors.New("username already exists")
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (repo *Repository) List(ctx context.Context, limit int, offset int) (UserListResult, error) {
	if limit <= 0 || limit > 100 {
		limit = 10
	}
	if offset < 0 {
		offset = 0
	}

	var total int64
	if err := repo.db.QueryRow(ctx, `SELECT count(*) FROM users`).Scan(&total); err != nil {
		return UserListResult{}, fmt.Errorf("count users: %w", err)
	}

	if total == 0 {
		return UserListResult{Items: []User{}, Total: 0}, nil
	}

	rows, err := repo.db.Query(ctx, `
		SELECT id, name, username, role, is_active, avatar_url, notification_preferences, created_at, updated_at
		FROM users
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`, limit, offset)
	if err != nil {
		return UserListResult{}, fmt.Errorf("query users: %w", err)
	}
	defer rows.Close()

	var items []User
	for rows.Next() {
		var u User
		if err := rows.Scan(
			&u.ID,
			&u.Name,
			&u.Username,
			&u.Role,
			&u.IsActive,
			&u.AvatarURL,
			&u.NotificationPreferences,
			&u.CreatedAt,
			&u.UpdatedAt,
		); err != nil {
			return UserListResult{}, fmt.Errorf("scan user: %w", err)
		}
		items = append(items, u)
	}
	if err := rows.Err(); err != nil {
		return UserListResult{}, fmt.Errorf("iterate users: %w", err)
	}

	return UserListResult{Items: items, Total: total}, nil
}

func (repo *Repository) FindByUsername(ctx context.Context, username string) (User, error) {
	var u User
	err := repo.db.QueryRow(ctx, `
		SELECT id, name, username, role, is_active, avatar_url, notification_preferences, created_at, updated_at
		FROM users
		WHERE lower(username) = lower($1)
	`, strings.TrimSpace(username)).Scan(
		&u.ID,
		&u.Name,
		&u.Username,
		&u.Role,
		&u.IsActive,
		&u.AvatarURL,
		&u.NotificationPreferences,
		&u.CreatedAt,
		&u.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrUserNotFound
	}
	if err != nil {
		return User{}, fmt.Errorf("find user by username: %w", err)
	}

	return u, nil
}

func (repo *Repository) FindByID(ctx context.Context, id int64) (User, error) {
	var u User
	err := repo.db.QueryRow(ctx, `
		SELECT id, name, username, role, is_active, avatar_url, notification_preferences, created_at, updated_at
		FROM users
		WHERE id = $1
	`, id).Scan(
		&u.ID,
		&u.Name,
		&u.Username,
		&u.Role,
		&u.IsActive,
		&u.AvatarURL,
		&u.NotificationPreferences,
		&u.CreatedAt,
		&u.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrUserNotFound
	}
	if err != nil {
		return User{}, fmt.Errorf("find user by id: %w", err)
	}

	return u, nil
}

func (repo *Repository) Create(ctx context.Context, input CreateUserInput) (User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return User{}, fmt.Errorf("hash password: %w", err)
	}

	var u User
	err = repo.db.QueryRow(ctx, `
		INSERT INTO users (name, username, password_hash, role, is_active, avatar_url)
		VALUES ($1, $2, $3, $4, true, '')
		RETURNING id, name, username, role, is_active, avatar_url, notification_preferences, created_at, updated_at
	`, input.Name, strings.ToLower(strings.TrimSpace(input.Username)), string(hash), input.Role).Scan(
		&u.ID,
		&u.Name,
		&u.Username,
		&u.Role,
		&u.IsActive,
		&u.AvatarURL,
		&u.NotificationPreferences,
		&u.CreatedAt,
		&u.UpdatedAt,
	)

	if err != nil {
		if strings.Contains(err.Error(), "users_username_key") || strings.Contains(err.Error(), "duplicate key") {
			return User{}, ErrUsernameDuplicate
		}
		return User{}, fmt.Errorf("create user: %w", err)
	}

	return u, nil
}

func (repo *Repository) Update(ctx context.Context, username string, input UpdateUserInput) (User, error) {
	tag, err := repo.db.Exec(ctx, `
		UPDATE users
		SET name = $2, role = $3, is_active = $4
		WHERE lower(username) = lower($1)
	`, strings.TrimSpace(username), input.Name, input.Role, input.IsActive)
	if err != nil {
		return User{}, fmt.Errorf("update user: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return User{}, ErrUserNotFound
	}

	return repo.FindByUsername(ctx, username)
}

func (repo *Repository) ResetPassword(ctx context.Context, username string, newPassword string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	tag, err := repo.db.Exec(ctx, `
		UPDATE users
		SET password_hash = $2
		WHERE lower(username) = lower($1)
	`, strings.TrimSpace(username), string(hash))
	if err != nil {
		return fmt.Errorf("reset password: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrUserNotFound
	}

	return nil
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

func (repo *Repository) UpdateAvatar(ctx context.Context, username string, avatarUrl string) error {
	result, err := repo.db.Exec(ctx, `
		UPDATE users
		SET avatar_url = $1, updated_at = now()
		WHERE lower(username) = lower($2)
	`, avatarUrl, strings.TrimSpace(username))
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrUserNotFound
	}
	return nil
}

func (repo *Repository) UpdateNotificationPreferences(ctx context.Context, username string, prefs map[string]any) error {
	result, err := repo.db.Exec(ctx, `
		UPDATE users
		SET notification_preferences = $1, updated_at = now()
		WHERE lower(username) = lower($2)
	`, prefs, strings.TrimSpace(username))
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrUserNotFound
	}
	return nil
}
