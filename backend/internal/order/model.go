package order

import "time"

type CreateOrderInput struct {
	CustomerName  string
	CustomerPhone *string
	ServiceCode   string
	WeightGrams   int64
	RoastLevel    *string
	GrindLevel    *string
	Notes         *string
	PaymentType   string
	PaidAmount    int64
	CreatedBy     int64
}

type UpdateOrderStatusInput struct {
	OrderStatus string
	Notes       *string
	ActorID     int64
}

type BulkUpdateOrderStatusInput struct {
	OrderCodes  []string
	OrderStatus string
	Notes       *string
	ActorID     int64
}

type BulkUpdateOrderStatusResult struct {
	RequestedCount int
	UpdatedCount   int
	SkippedCount   int
	NotFoundCount  int
}

type Order struct {
	ID            int64
	OrderCode     string
	CustomerID    int64
	CustomerName  string
	CustomerPhone *string
	ServiceID     int16
	ServiceCode   string
	ServiceName   string
	WeightKg      string
	PricePerKg    int64
	TotalAmount   int64
	PaidAmount    int64
	PaymentStatus string
	OrderStatus   string
	RoastLevel    *string
	GrindLevel    *string
	Notes         *string
	CreatedBy     int64
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type OrderListResult struct {
	Items []Order
	Total int64
}

type ListOrdersFilter struct {
	Limit         int
	Offset        int
	OrderStatus   string
	PaymentStatus string
	Search        string
	ServiceCode   string
	SortBy        string
	SortDirection string
}
