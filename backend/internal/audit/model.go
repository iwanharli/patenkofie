package audit

import "time"

type AuditLog struct {
	ID        int64     `json:"id"`
	UserID    int64     `json:"user_id"`
	UserName  string    `json:"user_name"`
	UserRole  string    `json:"user_role"`
	Action    string    `json:"action"`
	Entity    string    `json:"entity"`
	EntityID  string    `json:"entity_id"`
	Payload   string    `json:"payload"`
	CreatedAt time.Time `json:"created_at"`
}

type AuditLogListResult struct {
	Items []AuditLog `json:"items"`
	Total int64      `json:"total"`
}

type AuditLogFilter struct {
	Limit  int
	Offset int
	Action string
	Entity   string
	EntityID string
	Search   string
}
