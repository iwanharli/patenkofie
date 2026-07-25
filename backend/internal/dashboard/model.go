package dashboard

import "time"

type Summary struct {
	TransactionsToday       int64
	TransactionsPrevious    int64
	CoffeeWeightTodayKg     string
	CashAmountToday         int64
	CashPaymentsToday       int64
	OutstandingAmountActive int64
	OutstandingOrdersActive int64
}

type QueueOrder struct {
	OrderCode    string
	CustomerName string
	CreatedAt    time.Time
}

type QueueSummary struct {
	Status string
	Count  int64
	Orders []QueueOrder
}

type RecentOrder struct {
	OrderCode     string
	CustomerName  string
	ServiceCode   string
	ServiceName   string
	WeightKg      string
	TotalAmount   int64
	PaymentStatus string
	OrderStatus   string
	CreatedAt     time.Time
}

type ServiceBreakdown struct {
	ServiceCode string
	ServiceName string
	OrderCount  int64
	WeightKg    string
	Amount      int64
}

type PickupSummary struct {
	ReadyCount       int64
	PaidReadyCount   int64
	UnpaidReadyCount int64
}

type ActivityItem struct {
	OrderCode    string
	CustomerName string
	Status       string
	Notes        *string
	ChangedAt    time.Time
}

type Overview struct {
	GeneratedAt       time.Time
	BusinessDate      time.Time
	StartDate         time.Time
	EndDate           time.Time
	Summary           Summary
	Queues            []QueueSummary
	RecentOrders      []RecentOrder
	ServiceBreakdowns []ServiceBreakdown
	PickupSummary     PickupSummary
	Activities        []ActivityItem
}
