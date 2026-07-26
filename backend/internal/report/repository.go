package report

import (
	"context"
	"encoding/csv"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (repo *Repository) GetOverview(ctx context.Context, filter Filter) (OverviewReport, error) {
	startDate, endDate := normalizeDateRange(filter.StartDate, filter.EndDate)

	// 1. Order stats
	orderQuery := `
		SELECT
			COALESCE(count(*), 0) AS total_count,
			COALESCE(sum(total_amount), 0) AS total_amount,
			COALESCE(sum(weight_kg), 0)::text AS total_weight_kg
		FROM orders o
		JOIN services s ON s.id = o.service_id
		WHERE o.order_status != 'DIBATALKAN'
		  AND o.created_at >= $1::timestamptz
		  AND o.created_at <= $2::timestamptz
	`
	var orderArgs []any
	orderArgs = append(orderArgs, startDate, endDate)
	if filter.ServiceCode != "" && filter.ServiceCode != "ALL" {
		orderQuery += ` AND s.code = $3`
		orderArgs = append(orderArgs, strings.ToUpper(filter.ServiceCode))
	}

	var report OverviewReport
	if err := repo.db.QueryRow(ctx, orderQuery, orderArgs...).Scan(
		&report.TotalOrderCount,
		&report.TotalOrderAmount,
		&report.TotalWeightKg,
	); err != nil {
		return OverviewReport{}, fmt.Errorf("query order overview: %w", err)
	}

	// 2. Cash payment stats
	cashQuery := `
		SELECT
			COALESCE(count(*), 0) AS total_count,
			COALESCE(sum(p.amount), 0) AS total_amount
		FROM payments p
		JOIN orders o ON o.id = p.order_id
		JOIN services s ON s.id = o.service_id
		WHERE p.paid_at >= $1::timestamptz
		  AND p.paid_at <= $2::timestamptz
	`
	var cashArgs []any
	cashArgs = append(cashArgs, startDate, endDate)
	if filter.ServiceCode != "" && filter.ServiceCode != "ALL" {
		cashQuery += ` AND s.code = $3`
		cashArgs = append(cashArgs, strings.ToUpper(filter.ServiceCode))
	}

	if err := repo.db.QueryRow(ctx, cashQuery, cashArgs...).Scan(
		&report.TotalCashCount,
		&report.TotalCashReceived,
	); err != nil {
		return OverviewReport{}, fmt.Errorf("query cash overview: %w", err)
	}

	// 3. Receivable stats
	recQuery := `
		SELECT
			COALESCE(count(*), 0) AS total_count,
			COALESCE(sum(total_amount - paid_amount), 0) AS total_amount
		FROM orders o
		JOIN services s ON s.id = o.service_id
		WHERE o.order_status NOT IN ('SELESAI', 'DIBATALKAN')
		  AND o.total_amount > o.paid_amount
	`
	var recArgs []any
	if filter.ServiceCode != "" && filter.ServiceCode != "ALL" {
		recQuery += ` AND s.code = $1`
		recArgs = append(recArgs, strings.ToUpper(filter.ServiceCode))
	}

	if err := repo.db.QueryRow(ctx, recQuery, recArgs...).Scan(
		&report.TotalReceivableCount,
		&report.TotalReceivableAmount,
	); err != nil {
		return OverviewReport{}, fmt.Errorf("query receivable overview: %w", err)
	}

	// 4. Daily chart points
	chartStart := startDate

	subqueryWhere := "WHERE o.order_status != 'DIBATALKAN'"
	var chartArgs []any
	chartArgs = append(chartArgs, chartStart, endDate)
	chartArgIdx := 3

	if filter.ServiceCode != "" && filter.ServiceCode != "ALL" {
		subqueryWhere += fmt.Sprintf(` AND s.code = $%d`, chartArgIdx)
		chartArgs = append(chartArgs, strings.ToUpper(filter.ServiceCode))
		chartArgIdx++
	}
	if filter.OrderStatus != "" && filter.OrderStatus != "ALL" {
		subqueryWhere += fmt.Sprintf(` AND o.order_status = $%d`, chartArgIdx)
		chartArgs = append(chartArgs, strings.ToUpper(filter.OrderStatus))
		chartArgIdx++
	}
	if filter.PaymentStatus != "" && filter.PaymentStatus != "ALL" {
		subqueryWhere += fmt.Sprintf(` AND o.payment_status = $%d`, chartArgIdx)
		chartArgs = append(chartArgs, strings.ToUpper(filter.PaymentStatus))
		chartArgIdx++
	}

	chartQuery := fmt.Sprintf(`
		SELECT
			to_char(d.day, 'YYYY-MM-DD') AS day_date,
			to_char(d.day, 'DD/MM') AS day_label,
			COALESCE(sum(o.total_amount), 0) AS daily_amount,
			COALESCE(sum(o.weight_kg), 0)::text AS daily_weight,
			COALESCE(count(o.id), 0) AS daily_count
		FROM generate_series(($1::timestamptz AT TIME ZONE 'Asia/Jakarta')::date, ($2::timestamptz AT TIME ZONE 'Asia/Jakarta')::date, '1 day'::interval) d(day)
		LEFT JOIN (
			SELECT o.*, s.code AS service_code
			FROM orders o
			JOIN services s ON s.id = o.service_id
			%s
		) o ON date_trunc('day', o.created_at AT TIME ZONE 'Asia/Jakarta') = d.day
		GROUP BY d.day
		ORDER BY d.day ASC
	`, subqueryWhere)

	rows, err := repo.db.Query(ctx, chartQuery, chartArgs...)
	if err != nil {
		return OverviewReport{}, fmt.Errorf("query chart overview: %w", err)
	}
	defer rows.Close()

	points := make([]ChartPoint, 0)
	for rows.Next() {
		var pt ChartPoint
		if err := rows.Scan(
			&pt.Date,
			&pt.Label,
			&pt.TotalAmount,
			&pt.WeightKg,
			&pt.OrderCount,
		); err != nil {
			return OverviewReport{}, fmt.Errorf("scan chart point: %w", err)
		}
		points = append(points, pt)
	}
	if err := rows.Err(); err != nil {
		return OverviewReport{}, fmt.Errorf("iterate chart points: %w", err)
	}

	report.ChartData = points
	return report, nil
}

func (repo *Repository) GetDetail(ctx context.Context, filter DetailFilter) (DetailReportResult, error) {
	startDate, endDate := normalizeDateRange(filter.StartDate, filter.EndDate)
	if filter.Limit <= 0 || filter.Limit > 100 {
		filter.Limit = 10
	}
	if filter.Offset < 0 {
		filter.Offset = 0
	}

	switch strings.ToLower(filter.Type) {
	case "cash":
		return repo.getDetailCash(ctx, startDate, endDate, filter)
	case "receivables":
		return repo.getDetailReceivables(ctx, filter)
	case "services":
		return repo.getDetailServices(ctx, startDate, endDate, filter)
	default: // "orders"
		return repo.getDetailOrders(ctx, startDate, endDate, filter)
	}
}

func (repo *Repository) getDetailOrders(ctx context.Context, startDate, endDate string, filter DetailFilter) (DetailReportResult, error) {
	countQuery := `
		SELECT count(*), COALESCE(sum(o.total_amount), 0)
		FROM orders o
		JOIN services s ON s.id = o.service_id
		WHERE o.created_at >= $1::timestamptz AND o.created_at <= $2::timestamptz
	`
	var args []any
	args = append(args, startDate, endDate)
	argIdx := 3
	if filter.ServiceCode != "" && filter.ServiceCode != "ALL" {
		countQuery += fmt.Sprintf(` AND s.code = $%d`, argIdx)
		args = append(args, strings.ToUpper(filter.ServiceCode))
		argIdx++
	}
	if filter.OrderStatus != "" && filter.OrderStatus != "ALL" {
		countQuery += fmt.Sprintf(` AND o.order_status = $%d`, argIdx)
		args = append(args, strings.ToUpper(filter.OrderStatus))
		argIdx++
	}
	if filter.PaymentStatus != "" && filter.PaymentStatus != "ALL" {
		countQuery += fmt.Sprintf(` AND o.payment_status = $%d`, argIdx)
		args = append(args, strings.ToUpper(filter.PaymentStatus))
		argIdx++
	}

	var totalCount int64
	var sumAmount int64
	if err := repo.db.QueryRow(ctx, countQuery, args...).Scan(&totalCount, &sumAmount); err != nil {
		return DetailReportResult{}, fmt.Errorf("count detail orders: %w", err)
	}

	listQuery := `
		SELECT
			o.order_code,
			o.created_at,
			o.total_amount,
			c.name || ' (' || s.name || ') · Penerima: ' || COALESCE(u.name, 'Sistem'),
			o.weight_kg::text || ' kg',
			o.order_status
		FROM orders o
		JOIN customers c ON c.id = o.customer_id
		JOIN services s ON s.id = o.service_id
		LEFT JOIN users u ON u.id = o.created_by
		WHERE o.created_at >= $1::timestamptz AND o.created_at <= $2::timestamptz
	`
	var listArgs []any
	listArgs = append(listArgs, startDate, endDate)
	listArgIdx := 3
	if filter.ServiceCode != "" && filter.ServiceCode != "ALL" {
		listQuery += fmt.Sprintf(` AND s.code = $%d`, listArgIdx)
		listArgs = append(listArgs, strings.ToUpper(filter.ServiceCode))
		listArgIdx++
	}
	if filter.OrderStatus != "" && filter.OrderStatus != "ALL" {
		listQuery += fmt.Sprintf(` AND o.order_status = $%d`, listArgIdx)
		listArgs = append(listArgs, strings.ToUpper(filter.OrderStatus))
		listArgIdx++
	}
	if filter.PaymentStatus != "" && filter.PaymentStatus != "ALL" {
		listQuery += fmt.Sprintf(` AND o.payment_status = $%d`, listArgIdx)
		listArgs = append(listArgs, strings.ToUpper(filter.PaymentStatus))
		listArgIdx++
	}

	listQuery += fmt.Sprintf(` ORDER BY o.created_at DESC LIMIT $%d OFFSET $%d`, listArgIdx, listArgIdx+1)
	listArgs = append(listArgs, filter.Limit, filter.Offset)

	rows, err := repo.db.Query(ctx, listQuery, listArgs...)
	if err != nil {
		return DetailReportResult{}, fmt.Errorf("list detail orders: %w", err)
	}
	defer rows.Close()

	items := make([]DetailRow, 0)
	for rows.Next() {
		var row DetailRow
		if err := rows.Scan(
			&row.Code,
			&row.Date,
			&row.PrimaryValue,
			&row.PrimaryText,
			&row.SecondaryText,
			&row.Status,
		); err != nil {
			return DetailReportResult{}, fmt.Errorf("scan detail order: %w", err)
		}
		items = append(items, row)
	}

	return DetailReportResult{
		Items:      items,
		MetricText: fmt.Sprintf("%d Transaksi", totalCount),
		Total:      totalCount,
	}, nil
}

func (repo *Repository) getDetailCash(ctx context.Context, startDate, endDate string, filter DetailFilter) (DetailReportResult, error) {
	countQuery := `
		SELECT count(*), COALESCE(sum(p.amount), 0)
		FROM payments p
		JOIN orders o ON o.id = p.order_id
		JOIN services s ON s.id = o.service_id
		WHERE p.paid_at >= $1::timestamptz AND p.paid_at <= $2::timestamptz
	`
	var args []any
	args = append(args, startDate, endDate)
	if filter.ServiceCode != "" && filter.ServiceCode != "ALL" {
		countQuery += ` AND s.code = $3`
		args = append(args, strings.ToUpper(filter.ServiceCode))
	}

	var totalCount int64
	var sumAmount int64
	if err := repo.db.QueryRow(ctx, countQuery, args...).Scan(&totalCount, &sumAmount); err != nil {
		return DetailReportResult{}, fmt.Errorf("count detail cash: %w", err)
	}

	listQuery := `
		SELECT
			'PAY-' || lpad(p.id::text, 6, '0'),
			p.paid_at,
			p.amount,
			c.name || ' (' || o.order_code || ')',
			'Diterima oleh ' || u.name,
			p.payment_type
		FROM payments p
		JOIN orders o ON o.id = p.order_id
		JOIN customers c ON c.id = o.customer_id
		JOIN services s ON s.id = o.service_id
		JOIN users u ON u.id = p.received_by
		WHERE p.paid_at >= $1::timestamptz AND p.paid_at <= $2::timestamptz
	`
	var listArgs []any
	listArgs = append(listArgs, startDate, endDate)
	argIdx := 3
	if filter.ServiceCode != "" && filter.ServiceCode != "ALL" {
		listQuery += fmt.Sprintf(` AND s.code = $%d`, argIdx)
		listArgs = append(listArgs, strings.ToUpper(filter.ServiceCode))
		argIdx++
	}

	listQuery += fmt.Sprintf(` ORDER BY p.paid_at DESC LIMIT $%d OFFSET $%d`, argIdx, argIdx+1)
	listArgs = append(listArgs, filter.Limit, filter.Offset)

	rows, err := repo.db.Query(ctx, listQuery, listArgs...)
	if err != nil {
		return DetailReportResult{}, fmt.Errorf("list detail cash: %w", err)
	}
	defer rows.Close()

	items := make([]DetailRow, 0)
	for rows.Next() {
		var row DetailRow
		if err := rows.Scan(
			&row.Code,
			&row.Date,
			&row.PrimaryValue,
			&row.PrimaryText,
			&row.SecondaryText,
			&row.Status,
		); err != nil {
			return DetailReportResult{}, fmt.Errorf("scan detail cash: %w", err)
		}
		items = append(items, row)
	}

	return DetailReportResult{
		Items:      items,
		MetricText: fmt.Sprintf("%d Pembayaran", totalCount),
		Total:      totalCount,
	}, nil
}

func (repo *Repository) getDetailReceivables(ctx context.Context, filter DetailFilter) (DetailReportResult, error) {
	countQuery := `
		SELECT count(*), COALESCE(sum(o.total_amount - o.paid_amount), 0)
		FROM orders o
		JOIN services s ON s.id = o.service_id
		WHERE o.order_status NOT IN ('SELESAI', 'DIBATALKAN') AND o.total_amount > o.paid_amount
	`
	var args []any
	if filter.ServiceCode != "" && filter.ServiceCode != "ALL" {
		countQuery += ` AND s.code = $1`
		args = append(args, strings.ToUpper(filter.ServiceCode))
	}

	var totalCount int64
	var sumAmount int64
	if err := repo.db.QueryRow(ctx, countQuery, args...).Scan(&totalCount, &sumAmount); err != nil {
		return DetailReportResult{}, fmt.Errorf("count detail receivables: %w", err)
	}

	listQuery := `
		SELECT
			o.order_code,
			o.created_at,
			(o.total_amount - o.paid_amount) AS remaining,
			c.name || ' (' || s.name || ')',
			'Total: Rp' || to_char(o.total_amount, 'FM999,999,999') || ' · Bayar: Rp' || to_char(o.paid_amount, 'FM999,999,999'),
			o.payment_status
		FROM orders o
		JOIN customers c ON c.id = o.customer_id
		JOIN services s ON s.id = o.service_id
		WHERE o.order_status NOT IN ('SELESAI', 'DIBATALKAN') AND o.total_amount > o.paid_amount
	`
	var listArgs []any
	argIdx := 1
	if filter.ServiceCode != "" && filter.ServiceCode != "ALL" {
		listQuery += fmt.Sprintf(` AND s.code = $%d`, argIdx)
		listArgs = append(listArgs, strings.ToUpper(filter.ServiceCode))
		argIdx++
	}

	listQuery += fmt.Sprintf(` ORDER BY o.created_at DESC LIMIT $%d OFFSET $%d`, argIdx, argIdx+1)
	listArgs = append(listArgs, filter.Limit, filter.Offset)

	rows, err := repo.db.Query(ctx, listQuery, listArgs...)
	if err != nil {
		return DetailReportResult{}, fmt.Errorf("list detail receivables: %w", err)
	}
	defer rows.Close()

	items := make([]DetailRow, 0)
	for rows.Next() {
		var row DetailRow
		if err := rows.Scan(
			&row.Code,
			&row.Date,
			&row.PrimaryValue,
			&row.PrimaryText,
			&row.SecondaryText,
			&row.Status,
		); err != nil {
			return DetailReportResult{}, fmt.Errorf("scan detail receivable: %w", err)
		}
		items = append(items, row)
	}

	return DetailReportResult{
		Items:      items,
		MetricText: fmt.Sprintf("%d Pesanan Belum Lunas", totalCount),
		Total:      totalCount,
	}, nil
}

func (repo *Repository) getDetailServices(ctx context.Context, startDate, endDate string, filter DetailFilter) (DetailReportResult, error) {
	listQuery := `
		SELECT
			s.code,
			now() AS date,
			COALESCE(sum(o.total_amount), 0) AS total_revenue,
			s.name,
			COALESCE(count(o.id), 0)::text || ' order · ' || COALESCE(sum(o.weight_kg), 0)::text || ' kg',
			s.code AS status
		FROM services s
		LEFT JOIN orders o ON o.service_id = s.id AND o.order_status != 'DIBATALKAN' AND o.created_at >= $1::timestamptz AND o.created_at <= $2::timestamptz
		GROUP BY s.id, s.code, s.name
		ORDER BY s.id ASC
	`
	rows, err := repo.db.Query(ctx, listQuery, startDate, endDate)
	if err != nil {
		return DetailReportResult{}, fmt.Errorf("list detail services: %w", err)
	}
	defer rows.Close()

	items := make([]DetailRow, 0)
	for rows.Next() {
		var row DetailRow
		if err := rows.Scan(
			&row.Code,
			&row.Date,
			&row.PrimaryValue,
			&row.PrimaryText,
			&row.SecondaryText,
			&row.Status,
		); err != nil {
			return DetailReportResult{}, fmt.Errorf("scan detail service: %w", err)
		}
		items = append(items, row)
	}

	return DetailReportResult{
		Items:      items,
		MetricText: fmt.Sprintf("%d Layanan", len(items)),
		Total:      int64(len(items)),
	}, nil
}

func normalizeDateRange(start, end string) (string, string) {
	loc, _ := time.LoadLocation("Asia/Jakarta")
	now := time.Now().In(loc)

	start = strings.TrimSpace(start)
	end = strings.TrimSpace(end)

	var startTime, endTime time.Time

	if start != "" {
		t, err := time.ParseInLocation("2006-01-02", start, loc)
		if err == nil {
			startTime = t
		}
	}
	if startTime.IsZero() {
		// Default to start of today
		startTime = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	}

	if end != "" {
		t, err := time.ParseInLocation("2006-01-02", end, loc)
		if err == nil {
			endTime = time.Date(t.Year(), t.Month(), t.Day(), 23, 59, 59, 999999999, loc)
		}
	}
	if endTime.IsZero() {
		// Default to end of today
		endTime = time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 999999999, loc)
	}

	return startTime.Format(time.RFC3339), endTime.Format(time.RFC3339)
}

func (repo *Repository) ExportCSVData(ctx context.Context, filter DetailFilter, writer *csv.Writer) error {
	startDate, endDate := normalizeDateRange(filter.StartDate, filter.EndDate)

	switch strings.ToLower(filter.Type) {
	case "cash":
		return repo.exportCashCSV(ctx, startDate, endDate, filter, writer)
	case "receivables":
		return repo.exportReceivablesCSV(ctx, filter, writer)
	case "services":
		return repo.exportServicesCSV(ctx, startDate, endDate, filter, writer)
	default: // "orders"
		return repo.exportOrdersCSV(ctx, startDate, endDate, filter, writer)
	}
}

func (repo *Repository) exportOrdersCSV(ctx context.Context, startDate, endDate string, filter DetailFilter, writer *csv.Writer) error {
	_ = writer.Write([]string{
		"Kode Order",
		"Waktu Buat",
		"Petugas Penerima",
		"Nama Pelanggan",
		"Telepon Pelanggan",
		"Kode Layanan",
		"Nama Layanan",
		"Berat (kg)",
		"Harga / kg (Rp)",
		"Total Biaya (Rp)",
		"Jumlah Terbayar (Rp)",
		"Sisa Pembayaran (Rp)",
		"Status Pembayaran",
		"Status Produksi",
		"Catatan",
	})

	query := `
		SELECT
			o.order_code,
			o.created_at,
			COALESCE(u.name, 'Sistem') AS created_by_name,
			c.name AS customer_name,
			COALESCE(c.phone, '-') AS customer_phone,
			s.code AS service_code,
			s.name AS service_name,
			o.weight_kg::text AS weight_kg,
			s.price_per_kg,
			o.total_amount,
			o.paid_amount,
			(o.total_amount - o.paid_amount) AS remaining_amount,
			o.payment_status,
			o.order_status,
			COALESCE(o.notes, '') AS notes
		FROM orders o
		JOIN customers c ON c.id = o.customer_id
		JOIN services s ON s.id = o.service_id
		LEFT JOIN users u ON u.id = o.created_by
		WHERE o.created_at >= $1::timestamptz AND o.created_at <= $2::timestamptz
	`
	var args []any
	args = append(args, startDate, endDate)
	argIdx := 3

	if filter.ServiceCode != "" && filter.ServiceCode != "ALL" {
		query += fmt.Sprintf(` AND s.code = $%d`, argIdx)
		args = append(args, strings.ToUpper(filter.ServiceCode))
		argIdx++
	}
	if filter.OrderStatus != "" && filter.OrderStatus != "ALL" {
		query += fmt.Sprintf(` AND o.order_status = $%d`, argIdx)
		args = append(args, strings.ToUpper(filter.OrderStatus))
		argIdx++
	}
	if filter.PaymentStatus != "" && filter.PaymentStatus != "ALL" {
		query += fmt.Sprintf(` AND o.payment_status = $%d`, argIdx)
		args = append(args, strings.ToUpper(filter.PaymentStatus))
		argIdx++
	}

	query += ` ORDER BY o.created_at DESC`

	rows, err := repo.db.Query(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("export orders query: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var code, createdByName, custName, custPhone, svcCode, svcName, weight, payStatus, ordStatus, notes string
		var createdAt time.Time
		var pricePerKg, totalAmt, paidAmt, remAmt int64

		if err := rows.Scan(
			&code, &createdAt, &createdByName, &custName, &custPhone, &svcCode, &svcName,
			&weight, &pricePerKg, &totalAmt, &paidAmt, &remAmt,
			&payStatus, &ordStatus, &notes,
		); err != nil {
			return fmt.Errorf("export orders scan: %w", err)
		}

		_ = writer.Write([]string{
			code,
			createdAt.Format("2006-01-02 15:04:05"),
			createdByName,
			custName,
			custPhone,
			svcCode,
			svcName,
			weight,
			fmt.Sprintf("%d", pricePerKg),
			fmt.Sprintf("%d", totalAmt),
			fmt.Sprintf("%d", paidAmt),
			fmt.Sprintf("%d", remAmt),
			payStatus,
			ordStatus,
			notes,
		})
	}
	writer.Flush()
	return nil
}

func (repo *Repository) exportCashCSV(ctx context.Context, startDate, endDate string, filter DetailFilter, writer *csv.Writer) error {
	_ = writer.Write([]string{
		"Kode Pembayaran",
		"Waktu Bayar",
		"Kode Order",
		"Nama Pelanggan",
		"Jenis Pembayaran",
		"Metode Pembayaran",
		"Nominal Diterima (Rp)",
		"Diterima Oleh",
		"Total Order (Rp)",
		"Sisa Order (Rp)",
		"Status Bayar Order",
		"Catatan",
	})

	query := `
		SELECT
			p.id,
			p.paid_at,
			o.order_code,
			c.name AS customer_name,
			p.payment_type,
			p.payment_method,
			p.amount,
			COALESCE(u.name, 'Sistem') AS received_by_name,
			o.total_amount AS order_total,
			(o.total_amount - o.paid_amount) AS order_remaining,
			o.payment_status AS order_payment_status,
			COALESCE(p.notes, '') AS notes
		FROM payments p
		JOIN orders o ON o.id = p.order_id
		JOIN customers c ON c.id = o.customer_id
		LEFT JOIN users u ON u.id = p.received_by
		JOIN services s ON s.id = o.service_id
		WHERE p.paid_at >= $1::timestamptz AND p.paid_at <= $2::timestamptz
	`
	var args []any
	args = append(args, startDate, endDate)
	argIdx := 3

	if filter.ServiceCode != "" && filter.ServiceCode != "ALL" {
		query += fmt.Sprintf(` AND s.code = $%d`, argIdx)
		args = append(args, strings.ToUpper(filter.ServiceCode))
		argIdx++
	}

	query += ` ORDER BY p.paid_at DESC, p.id DESC`

	rows, err := repo.db.Query(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("export cash query: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var id int64
		var paidAt time.Time
		var orderCode, custName, payType, payMethod, recByName, ordPayStatus, notes string
		var amount, ordTotal, ordRemaining int64

		if err := rows.Scan(
			&id, &paidAt, &orderCode, &custName, &payType, &payMethod,
			&amount, &recByName, &ordTotal, &ordRemaining, &ordPayStatus, &notes,
		); err != nil {
			return fmt.Errorf("export cash scan: %w", err)
		}

		_ = writer.Write([]string{
			fmt.Sprintf("PAY-%06d", id),
			paidAt.Format("2006-01-02 15:04:05"),
			orderCode,
			custName,
			payType,
			payMethod,
			fmt.Sprintf("%d", amount),
			recByName,
			fmt.Sprintf("%d", ordTotal),
			fmt.Sprintf("%d", ordRemaining),
			ordPayStatus,
			notes,
		})
	}
	writer.Flush()
	return nil
}

func (repo *Repository) exportServicesCSV(ctx context.Context, startDate, endDate string, filter DetailFilter, writer *csv.Writer) error {
	_ = writer.Write([]string{
		"Kode Layanan",
		"Nama Layanan",
		"Harga / kg (Rp)",
		"Jumlah Transaksi",
		"Total Volume (kg)",
		"Total Omset (Rp)",
	})

	query := `
		SELECT
			s.code,
			s.name,
			s.price_per_kg,
			count(o.id) AS total_orders,
			COALESCE(sum(o.weight_kg), 0)::text AS total_weight_kg,
			COALESCE(sum(o.total_amount), 0) AS total_revenue
		FROM services s
		LEFT JOIN orders o ON o.service_id = s.id
			AND o.order_status != 'DIBATALKAN'
			AND o.created_at >= $1::timestamptz AND o.created_at <= $2::timestamptz
		GROUP BY s.id, s.code, s.name, s.price_per_kg
		ORDER BY total_revenue DESC
	`

	rows, err := repo.db.Query(ctx, query, startDate, endDate)
	if err != nil {
		return fmt.Errorf("export services query: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var code, name, weight string
		var pricePerKg, totalOrders, totalRev int64

		if err := rows.Scan(&code, &name, &pricePerKg, &totalOrders, &weight, &totalRev); err != nil {
			return fmt.Errorf("export services scan: %w", err)
		}

		_ = writer.Write([]string{
			code,
			name,
			fmt.Sprintf("%d", pricePerKg),
			fmt.Sprintf("%d", totalOrders),
			weight,
			fmt.Sprintf("%d", totalRev),
		})
	}
	writer.Flush()
	return nil
}

func (repo *Repository) exportReceivablesCSV(ctx context.Context, filter DetailFilter, writer *csv.Writer) error {
	_ = writer.Write([]string{
		"Kode Order",
		"Waktu Order",
		"Nama Pelanggan",
		"Telepon Pelanggan",
		"Nama Layanan",
		"Total Order (Rp)",
		"Jumlah Terbayar (Rp)",
		"Sisa Piutang (Rp)",
		"Status Pembayaran",
		"Status Order",
		"Lama Belum Lunas (Hari)",
	})

	query := `
		SELECT
			o.order_code,
			o.created_at,
			c.name AS customer_name,
			COALESCE(c.phone, '-') AS customer_phone,
			s.name AS service_name,
			o.total_amount,
			o.paid_amount,
			(o.total_amount - o.paid_amount) AS remaining_amount,
			o.payment_status,
			o.order_status,
			COALESCE(EXTRACT(DAY FROM (now() - o.created_at))::int, 0) AS days_outstanding
		FROM orders o
		JOIN customers c ON c.id = o.customer_id
		JOIN services s ON s.id = o.service_id
		WHERE o.order_status NOT IN ('SELESAI', 'DIBATALKAN')
		  AND o.total_amount > o.paid_amount
	`
	var args []any
	argIdx := 1
	if filter.ServiceCode != "" && filter.ServiceCode != "ALL" {
		query += fmt.Sprintf(` AND s.code = $%d`, argIdx)
		args = append(args, strings.ToUpper(filter.ServiceCode))
		argIdx++
	}

	query += ` ORDER BY remaining_amount DESC, o.created_at ASC`

	rows, err := repo.db.Query(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("export receivables query: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var code, custName, custPhone, svcName, payStatus, ordStatus string
		var createdAt time.Time
		var totalAmt, paidAmt, remAmt int64
		var daysOut int

		if err := rows.Scan(
			&code, &createdAt, &custName, &custPhone, &svcName,
			&totalAmt, &paidAmt, &remAmt, &payStatus, &ordStatus, &daysOut,
		); err != nil {
			return fmt.Errorf("export receivables scan: %w", err)
		}

		_ = writer.Write([]string{
			code,
			createdAt.Format("2006-01-02 15:04:05"),
			custName,
			custPhone,
			svcName,
			fmt.Sprintf("%d", totalAmt),
			fmt.Sprintf("%d", paidAmt),
			fmt.Sprintf("%d", remAmt),
			payStatus,
			ordStatus,
			fmt.Sprintf("%d hari", daysOut),
		})
	}
	writer.Flush()
	return nil
}
