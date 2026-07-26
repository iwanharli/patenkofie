package auth

import "time"

type User struct {
	ID           int64
	Name         string
	Username     string
	PasswordHash string
	Role         string
	AvatarURL                *string
	IsActive                 bool
	NotificationPreferences  map[string]bool
}

type Session struct {
	Token     string
	UserID    int64
	ExpiresAt time.Time
}
