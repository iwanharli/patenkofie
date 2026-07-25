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
		SELECT id, name, username, password_hash, role, is_active
		FROM users
		WHERE username = $1 AND is_active = true
	`, username).Scan(
		&user.ID,
		&user.Name,
		&user.Username,
		&user.PasswordHash,
		&user.Role,
		&user.IsActive,
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
		SELECT id, name, username, password_hash, role, is_active
		FROM users
		WHERE id = $1 AND is_active = true
	`, id).Scan(
		&user.ID,
		&user.Name,
		&user.Username,
		&user.PasswordHash,
		&user.Role,
		&user.IsActive,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrUserNotFound
	}
	if err != nil {
		return User{}, fmt.Errorf("find user by id: %w", err)
	}

	return user, nil
}
