package payment

import "time"

type Payment struct {
	RowType        string
	ID             int64
	OrderID        int64
	OrderCode      string
	CustomerName   string
	PaymentType    string
	Amount         int64
	PaymentMethod  string
	ReceivedBy     int64
	ReceivedByName string
	PaidAt         time.Time
	Notes          *string
	OrderTotal     int64
	OrderPaid      int64
	OrderRemaining int64
	OrderPayStatus string
	OrderStatus    string
}

type Summary struct {
	CashToday        int64
	PaymentsToday    int64
	OutstandingTotal int64
	OutstandingCount int64
	TotalPayments    int64
}

type ListResult struct {
	Items   []Payment
	Summary Summary
	Total   int64
}

type ListFilter struct {
	Limit         int
	Offset        int
	OrderStatus   string
	PaymentStatus string
	PaymentType   string
	RowType       string
	Search        string
	SortBy        string
	SortDirection string
}

type SettleOrderInput struct {
	ActorID int64
	Notes   *string
}

type UpdatePaymentInput struct {
	ActorID int64
	Amount  int64
	Notes   *string
}
