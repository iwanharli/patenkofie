package expense

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrExpenseNotFound = errors.New("expense not found")

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (repo *Repository) Create(ctx context.Context, payload CreateExpensePayload, createdBy int64) (Expense, error) {
	var item Expense
	err := repo.db.QueryRow(ctx, `
		INSERT INTO expenses (amount, category, description, expense_date, created_by)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, amount, category, description, to_char(expense_date, 'YYYY-MM-DD'), created_by, created_at, updated_at
	`, payload.Amount, payload.Category, payload.Description, payload.ExpenseDate, createdBy).Scan(
		&item.ID,
		&item.Amount,
		&item.Category,
		&item.Description,
		&item.ExpenseDate,
		&item.CreatedBy,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		return Expense{}, fmt.Errorf("create expense: %w", err)
	}
	return item, nil
}

func (repo *Repository) Update(ctx context.Context, id int64, payload UpdateExpensePayload) (Expense, error) {
	var item Expense
	err := repo.db.QueryRow(ctx, `
		UPDATE expenses
		SET amount = $1, category = $2, description = $3, expense_date = $4
		WHERE id = $5
		RETURNING id, amount, category, description, to_char(expense_date, 'YYYY-MM-DD'), created_by, created_at, updated_at
	`, payload.Amount, payload.Category, payload.Description, payload.ExpenseDate, id).Scan(
		&item.ID,
		&item.Amount,
		&item.Category,
		&item.Description,
		&item.ExpenseDate,
		&item.CreatedBy,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Expense{}, ErrExpenseNotFound
		}
		return Expense{}, fmt.Errorf("update expense: %w", err)
	}
	return item, nil
}

func (repo *Repository) Delete(ctx context.Context, id int64) error {
	cmd, err := repo.db.Exec(ctx, "DELETE FROM expenses WHERE id = $1", id)
	if err != nil {
		return fmt.Errorf("delete expense: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return ErrExpenseNotFound
	}
	return nil
}

type ListExpensesResult struct {
	Items       []Expense
	Total       int
	TotalAmount int64
}

func (repo *Repository) List(ctx context.Context, startDate, endDate time.Time, limit, offset int) (ListExpensesResult, error) {
	var total int
	var totalAmount int64
	if err := repo.db.QueryRow(ctx, `
		SELECT count(*), coalesce(sum(amount), 0)
		FROM expenses
		WHERE expense_date >= $1 AND expense_date <= $2
	`, startDate.Format("2006-01-02"), endDate.Format("2006-01-02")).Scan(&total, &totalAmount); err != nil {
		return ListExpensesResult{}, fmt.Errorf("count expenses: %w", err)
	}

	rows, err := repo.db.Query(ctx, `
		SELECT id, amount, category, description, to_char(expense_date, 'YYYY-MM-DD'), created_by, created_at, updated_at
		FROM expenses
		WHERE expense_date >= $1 AND expense_date <= $2
		ORDER BY expense_date DESC, created_at DESC
		LIMIT $3 OFFSET $4
	`, startDate.Format("2006-01-02"), endDate.Format("2006-01-02"), limit, offset)
	if err != nil {
		return ListExpensesResult{}, fmt.Errorf("list expenses query: %w", err)
	}
	defer rows.Close()

	var items []Expense
	for rows.Next() {
		var item Expense
		if err := rows.Scan(
			&item.ID,
			&item.Amount,
			&item.Category,
			&item.Description,
			&item.ExpenseDate,
			&item.CreatedBy,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return ListExpensesResult{}, fmt.Errorf("list expenses scan: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return ListExpensesResult{}, fmt.Errorf("list expenses iter: %w", err)
	}
	return ListExpensesResult{Items: items, Total: total, TotalAmount: totalAmount}, nil
}
