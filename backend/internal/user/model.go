package user

import "time"

type User struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Username  string    `json:"username"`
	Role      string    `json:"role"`
	IsActive  bool      `json:"is_active"`
	AvatarURL               string         `json:"avatar_url"`
	NotificationPreferences map[string]any `json:"notification_preferences"`
	CreatedAt               time.Time      `json:"created_at"`
	UpdatedAt               time.Time      `json:"updated_at"`
}

type CreateUserInput struct {
	Name     string
	Username string
	Password string
	Role     string
}

type UpdateUserInput struct {
	Name     string
	Role     string
	IsActive bool
}

type UserListResult struct {
	Items []User
	Total int64
}
