package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"time"

	"golang.org/x/crypto/bcrypt"

	"paten-kopi/backend/internal/database"
	"paten-kopi/backend/internal/platform/config"
)

func main() {
	name := flag.String("name", "Ilham", "display name")
	username := flag.String("username", "ilham", "login username")
	password := flag.String("password", "", "login password")
	role := flag.String("role", "OWNER", "user role")
	flag.Parse()

	if *password == "" {
		fmt.Fprintln(os.Stderr, "password is required")
		os.Exit(1)
	}

	cfg := config.Load()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	db, err := database.OpenPostgres(ctx, cfg.DatabaseURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "connect database: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(*password), bcrypt.DefaultCost)
	if err != nil {
		fmt.Fprintf(os.Stderr, "hash password: %v\n", err)
		os.Exit(1)
	}

	var userID int64
	err = db.QueryRow(ctx, `
		INSERT INTO users (name, username, password_hash, role, is_active)
		VALUES ($1, $2, $3, $4, true)
		ON CONFLICT (username)
		DO UPDATE SET
			name = EXCLUDED.name,
			password_hash = EXCLUDED.password_hash,
			role = EXCLUDED.role,
			is_active = true,
			updated_at = now()
		RETURNING id
	`, *name, *username, string(passwordHash), *role).Scan(&userID)
	if err != nil {
		fmt.Fprintf(os.Stderr, "upsert user: %v\n", err)
		os.Exit(1)
	}

	_, err = db.Exec(ctx, `
		UPDATE services
		SET updated_by = $1, updated_at = now()
		WHERE code IN ('G', 'R', 'GR')
	`, userID)
	if err != nil {
		fmt.Fprintf(os.Stderr, "assign services owner: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("seeded user %s with id %d and assigned service pricing\n", *username, userID)
}
