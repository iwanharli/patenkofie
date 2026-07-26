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

type Customer struct {
	ID            int64
	Name          string
	Phone         *string
	Address       *string
	Notes         *string
	TotalOrders   int64
	TotalWeightKg string
	TotalSpent    int64
	Receivable    int64
	LastOrderAt   *time.Time
	CreatedAt     time.Time
}

type CustomerListResult struct {
	Items []Customer
	Total int64
}

type CustomerListFilter struct {
	Limit  int
	Offset int
	Search string
}

type CustomerOrder struct {
	ID            int64
	OrderCode     string
	ServiceCode   string
	ServiceName   string
	WeightKg      string
	TotalAmount   int64
	PaidAmount    int64
	PaymentStatus string
	OrderStatus   string
	CreatedAt     time.Time
}

type UpdateCustomerInput struct {
	Name    string
	Phone   *string
	Address *string
	Notes   *string
}

