package setting

import (
	"bytes"
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (repo *Repository) GetBusinessProfile(ctx context.Context) (BusinessProfile, error) {
	rows, err := repo.db.Query(ctx, `
		SELECT key, value, updated_at
		FROM app_settings
		WHERE key IN ('business_name', 'business_address', 'business_phone', 'receipt_footer', 'STORE_LOGO')
	`)
	if err != nil {
		return BusinessProfile{}, fmt.Errorf("query business profile settings: %w", err)
	}
	defer rows.Close()

	profile := BusinessProfile{
		BusinessName:    "PatenAndum",
		BusinessAddress: "Jl. Raya Kopi No. 123",
		BusinessPhone:   "0812-3456-7890",
		ReceiptFooter:   "Terima kasih atas kunjungan Anda. Harap simpan label QR ini.",
		UpdatedAt:       time.Now(),
	}

	for rows.Next() {
		var key, val string
		var updatedAt time.Time
		if err := rows.Scan(&key, &val, &updatedAt); err == nil {
			switch key {
			case "business_name":
				if val != "" {
					profile.BusinessName = val
				}
			case "business_address":
				profile.BusinessAddress = val
			case "business_phone":
				profile.BusinessPhone = val
			case "receipt_footer":
				profile.ReceiptFooter = val
			case "STORE_LOGO":
				profile.LogoURL = val
			}
			if updatedAt.After(profile.UpdatedAt) {
				profile.UpdatedAt = updatedAt
			}
		}
	}

	return profile, nil
}

func (repo *Repository) UpdateBusinessProfile(ctx context.Context, input UpdateBusinessProfileInput) (BusinessProfile, error) {
	tx, err := repo.db.Begin(ctx)
	if err != nil {
		return BusinessProfile{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	settings := map[string]string{
		"business_name":    strings.TrimSpace(input.BusinessName),
		"business_address": strings.TrimSpace(input.BusinessAddress),
		"business_phone":   strings.TrimSpace(input.BusinessPhone),
		"receipt_footer":   strings.TrimSpace(input.ReceiptFooter),
	}

	for key, val := range settings {
		_, err := tx.Exec(ctx, `
			INSERT INTO app_settings (key, value, updated_by, updated_at)
			VALUES ($1, $2, $3, now())
			ON CONFLICT (key) DO UPDATE
			SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()
		`, key, val, input.ActorID)
		if err != nil {
			return BusinessProfile{}, fmt.Errorf("upsert setting %s: %w", key, err)
		}
	}

	if input.ActorID > 0 {
		payload := fmt.Sprintf(`{"business_name":"%s"}`, strings.TrimSpace(input.BusinessName))
		_, _ = tx.Exec(ctx, `
			INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
			VALUES ($1, 'UPDATE_PROFILE', 'app_settings', '0', $2::jsonb)
		`, input.ActorID, payload)
	}

	if err := tx.Commit(ctx); err != nil {
		return BusinessProfile{}, fmt.Errorf("commit profile tx: %w", err)
	}

	return repo.GetBusinessProfile(ctx)
}

func (repo *Repository) ExportBackup(ctx context.Context) ([]byte, string, error) {
	tables := []string{
		"users",
		"customers",
		"services",
		"orders",
		"payments",
		"pickups",
		"order_status_logs",
		"daily_sequences",
		"app_settings",
		"audit_logs",
	}

	var buf bytes.Buffer
	buf.WriteString(fmt.Sprintf("-- PatenAndum Database Backup Dump\n-- Generated At: %s\n-- Database: db_patenandum\n\n", time.Now().Format(time.RFC3339)))
	buf.WriteString("SET statement_timeout = 0;\nSET client_encoding = 'UTF8';\n\n")

	for _, table := range tables {
		rows, err := repo.db.Query(ctx, fmt.Sprintf("SELECT * FROM %s", table))
		if err != nil {
			continue
		}

		fieldDescriptions := rows.FieldDescriptions()
		colNames := make([]string, len(fieldDescriptions))
		for i, fd := range fieldDescriptions {
			colNames[i] = string(fd.Name)
		}

		buf.WriteString(fmt.Sprintf("-- Data for table %s\n", table))

		for rows.Next() {
			values, err := rows.Values()
			if err != nil {
				continue
			}

			valStrs := make([]string, len(values))
			for i, val := range values {
				if val == nil {
					valStrs[i] = "NULL"
				} else {
					switch v := val.(type) {
					case string:
						valStrs[i] = fmt.Sprintf("'%s'", strings.ReplaceAll(v, "'", "''"))
					case time.Time:
						valStrs[i] = fmt.Sprintf("'%s'", v.Format(time.RFC3339))
					default:
						valStrs[i] = fmt.Sprintf("%v", v)
					}
				}
			}

			buf.WriteString(fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s) ON CONFLICT DO NOTHING;\n",
				table, strings.Join(colNames, ", "), strings.Join(valStrs, ", ")))
		}
		rows.Close()
		buf.WriteString("\n")
	}

	loc, _ := time.LoadLocation("Asia/Jakarta")
	filename := fmt.Sprintf("db_patenandum_backup_%s.sql", time.Now().In(loc).Format("2006-01-02_150405"))
	return buf.Bytes(), filename, nil
}

func (repo *Repository) UpdateLogo(ctx context.Context, actorID int64, logoUrl string) error {
	_, err := repo.db.Exec(ctx, `
		INSERT INTO app_settings (key, value, description, updated_by, updated_at)
		VALUES ($1, $2, 'URL logo toko', $3, now())
		ON CONFLICT (key) DO UPDATE
		SET value = EXCLUDED.value,
			updated_by = EXCLUDED.updated_by,
			updated_at = EXCLUDED.updated_at
	`, "STORE_LOGO", logoUrl, actorID)
	return err
}
