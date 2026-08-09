package expense

import (
	"time"
)

type Category string

const (
	CategoryOperasional Category = "OPERASIONAL"
	CategoryBahanBaku   Category = "BAHAN_BAKU"
	CategoryLainnya     Category = "LAINNYA"
)

type Expense struct {
	ID          int64     `json:"id"`
	Amount      int64     `json:"amount"`
	Category    Category  `json:"category"`
	Description string    `json:"description"`
	ExpenseDate string    `json:"expense_date"`
	CreatedBy   int64     `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CreateExpensePayload struct {
	Amount      int64    `json:"amount"`
	Category    Category `json:"category"`
	Description string   `json:"description"`
	ExpenseDate string   `json:"expense_date"`
}

type UpdateExpensePayload struct {
	Amount      int64    `json:"amount"`
	Category    Category `json:"category"`
	Description string   `json:"description"`
	ExpenseDate string   `json:"expense_date"`
}
