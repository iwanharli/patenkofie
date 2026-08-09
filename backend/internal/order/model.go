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

type UpdateOrderInput struct {
	CustomerName  string
	CustomerPhone *string
	ServiceCode   string
	WeightGrams   int64
	RoastLevel    *string
	GrindLevel    *string
	Notes         *string
	ActorID       int64
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

type OrderStatusLogItem struct {
	PreviousStatus string    `json:"previous_status"`
	NewStatus      string    `json:"new_status"`
	ChangedByName  string    `json:"changed_by_name"`
	ChangedAt      time.Time `json:"changed_at"`
	Notes          string    `json:"notes"`
}

type Order struct {
	ID             int64                `json:"id"`
	OrderCode      string               `json:"order_code"`
	CustomerID     int64                `json:"customer_id"`
	CustomerName   string               `json:"customer_name"`
	CustomerPhone  *string              `json:"customer_phone"`
	ServiceID      int16                `json:"service_id"`
	ServiceCode    string               `json:"service_code"`
	ServiceName    string               `json:"service_name"`
	WeightKg       string               `json:"weight_kg"`
	PricePerKg     int64                `json:"price_per_kg"`
	TotalAmount    int64                `json:"total_amount"`
	PaidAmount     int64                `json:"paid_amount"`
	PaymentStatus  string               `json:"payment_status"`
	OrderStatus    string               `json:"order_status"`
	RoastLevel     *string              `json:"roast_level"`
	GrindLevel     *string              `json:"grind_level"`
	Notes          *string              `json:"notes"`
	CreatedBy      int64                `json:"created_by"`
	CreatedByName  string               `json:"created_by_name"`
	PickedUpByName *string              `json:"picked_up_by_name"`
	CreatedAt      time.Time            `json:"created_at"`
	UpdatedAt      time.Time            `json:"updated_at"`
	StatusLogs     []OrderStatusLogItem `json:"status_logs"`
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
