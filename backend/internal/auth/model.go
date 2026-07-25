package auth

import "time"

type User struct {
	ID           int64
	Name         string
	Username     string
	PasswordHash string
	Role         string
	IsActive     bool
}

type Session struct {
	Token     string
	UserID    int64
	ExpiresAt time.Time
}
