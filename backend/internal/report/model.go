package report

import "time"

type OverviewReport struct {
	TotalOrderAmount       int64        `json:"total_order_amount"`
	TotalOrderCount        int64        `json:"total_order_count"`
	TotalCashReceived      int64        `json:"total_cash_received"`
	TotalCashCount         int64        `json:"total_cash_count"`
	TotalWeightKg          string       `json:"total_weight_kg"`
	TotalReceivableAmount  int64        `json:"total_receivable_amount"`
	TotalReceivableCount   int64        `json:"total_receivable_count"`
	ChartData              []ChartPoint `json:"chart_data"`
}

type ChartPoint struct {
	Date        string `json:"date"`
	Label       string `json:"label"`
	TotalAmount int64  `json:"total_amount"`
	WeightKg    string `json:"weight_kg"`
	OrderCount  int64  `json:"order_count"`
}

type DetailRow struct {
	ID            string    `json:"id"`
	Code          string    `json:"code"`
	Date          time.Time `json:"date"`
	PrimaryValue  int64     `json:"primary_value"`
	PrimaryText   string    `json:"primary_text"`
	SecondaryText string    `json:"secondary_text"`
	Status        string    `json:"status"`
}

type DetailReportResult struct {
	Items      []DetailRow `json:"items"`
	MetricText string      `json:"metric_text"`
	Total      int64       `json:"total"`
}

type Filter struct {
	EndDate       string
	OrderStatus   string
	PaymentStatus string
	ServiceCode   string
	StartDate     string
}

type DetailFilter struct {
	Filter
	Limit  int
	Offset int
	Type   string // orders, cash, services, receivables
}

