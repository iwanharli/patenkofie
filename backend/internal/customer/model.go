package customer

import "time"

type CustomerSuggestion struct {
	ID            int64
	Name          string
	Phone         *string
	Address       *string
	Notes         *string
	TotalOrders   int64
	TotalWeightKg string
	LastOrderAt   *time.Time
	CreatedAt     time.Time
}
