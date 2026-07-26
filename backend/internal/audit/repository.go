package audit

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
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

func (repo *Repository) List(ctx context.Context, filter AuditLogFilter) (AuditLogListResult, error) {
	if filter.Limit <= 0 || filter.Limit > 100 {
		filter.Limit = 15
	}
	if filter.Offset < 0 {
		filter.Offset = 0
	}

	whereClauses := []string{"1 = 1"}
	args := []any{}

	if filter.Action != "" && filter.Action != "ALL" {
		args = append(args, strings.ToUpper(filter.Action))
		whereClauses = append(whereClauses, fmt.Sprintf("a.action = $%d", len(args)))
	}
	if filter.Entity != "" && filter.Entity != "ALL" {
		args = append(args, strings.ToLower(filter.Entity))
		whereClauses = append(whereClauses, fmt.Sprintf("a.entity_type = $%d", len(args)))
	}
	if filter.EntityID != "" {
		args = append(args, filter.EntityID)
		whereClauses = append(whereClauses, fmt.Sprintf("a.entity_id = $%d", len(args)))
	}
	if filter.Search != "" {
		pattern := "%" + strings.ToLower(strings.TrimSpace(filter.Search)) + "%"
		args = append(args, pattern)
		whereClauses = append(whereClauses, fmt.Sprintf(
			"(lower(COALESCE(u.name, '')) LIKE $%d OR lower(a.action) LIKE $%d OR lower(a.entity_type) LIKE $%d OR lower(a.metadata::text) LIKE $%d)",
			len(args), len(args), len(args), len(args),
		))
	}

	whereStr := strings.Join(whereClauses, " AND ")

	countQuery := fmt.Sprintf(`
		SELECT count(*)
		FROM audit_logs a
		LEFT JOIN users u ON u.id = a.actor_id
		WHERE %s
	`, whereStr)

	var total int64
	if err := repo.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return AuditLogListResult{}, fmt.Errorf("count audit logs: %w", err)
	}

	args = append(args, filter.Limit, filter.Offset)
	limitIdx := len(args) - 1
	offsetIdx := len(args)

	dataQuery := fmt.Sprintf(`
		SELECT
			a.id,
			COALESCE(a.actor_id, 0),
			COALESCE(u.name, 'Sistem / Pengguna Terhapus'),
			COALESCE(u.role, 'STAFF'),
			a.action,
			a.entity_type,
			COALESCE(a.entity_id, ''),
			COALESCE(a.metadata::text, '{}'),
			a.created_at
		FROM audit_logs a
		LEFT JOIN users u ON u.id = a.actor_id
		WHERE %s
		ORDER BY a.created_at DESC, a.id DESC
		LIMIT $%d OFFSET $%d
	`, whereStr, limitIdx, offsetIdx)

	rows, err := repo.db.Query(ctx, dataQuery, args...)
	if err != nil {
		return AuditLogListResult{}, fmt.Errorf("query audit logs: %w", err)
	}
	defer rows.Close()

	items := make([]AuditLog, 0)
	for rows.Next() {
		var logItem AuditLog
		err := rows.Scan(
			&logItem.ID,
			&logItem.UserID,
			&logItem.UserName,
			&logItem.UserRole,
			&logItem.Action,
			&logItem.Entity,
			&logItem.EntityID,
			&logItem.Payload,
			&logItem.CreatedAt,
		)
		if err != nil {
			return AuditLogListResult{}, fmt.Errorf("scan audit log: %w", err)
		}
		items = append(items, logItem)
	}

	return AuditLogListResult{
		Items: items,
		Total: total,
	}, nil
}

var ErrAuditLogNotFound = errors.New("audit log not found")

func (repo *Repository) FindByID(ctx context.Context, id int64) (AuditLog, error) {
	dataQuery := `
		SELECT
			a.id,
			COALESCE(a.actor_id, 0),
			COALESCE(u.name, 'Sistem / Pengguna Terhapus'),
			COALESCE(u.role, 'STAFF'),
			a.action,
			a.entity_type,
			COALESCE(a.entity_id, ''),
			COALESCE(a.metadata::text, '{}'),
			a.created_at
		FROM audit_logs a
		LEFT JOIN users u ON u.id = a.actor_id
		WHERE a.id = $1
	`

	var logItem AuditLog
	err := repo.db.QueryRow(ctx, dataQuery, id).Scan(
		&logItem.ID,
		&logItem.UserID,
		&logItem.UserName,
		&logItem.UserRole,
		&logItem.Action,
		&logItem.Entity,
		&logItem.EntityID,
		&logItem.Payload,
		&logItem.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return AuditLog{}, ErrAuditLogNotFound
	}
	if err != nil {
		return AuditLog{}, fmt.Errorf("find audit log by id: %w", err)
	}

	return logItem, nil
}
