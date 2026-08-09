package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/rs/zerolog/log"

	"paten-kopi/backend/internal/auth"
	"paten-kopi/backend/internal/customer"
	"paten-kopi/backend/internal/dashboard"
	"paten-kopi/backend/internal/database"
	"paten-kopi/backend/internal/expense"
	"paten-kopi/backend/internal/notification"
	"paten-kopi/backend/internal/order"
	"paten-kopi/backend/internal/payment"
	"paten-kopi/backend/internal/pickup"
	"paten-kopi/backend/internal/platform/config"
	"paten-kopi/backend/internal/platform/logger"
	reportpkg "paten-kopi/backend/internal/report"
	auditpkg "paten-kopi/backend/internal/audit"
	services "paten-kopi/backend/internal/service"
	settingpkg "paten-kopi/backend/internal/setting"
	userpkg "paten-kopi/backend/internal/user"
)

func main() {
	cfg := config.Load()
	logger.Configure(cfg.AppEnv)

	db, err := database.OpenPostgres(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatal().Err(err).Msg("database connection failed")
	}
	defer db.Close()

	sessionStore := auth.NewSessionStore(8 * time.Hour)
	authRepo := auth.NewRepository(db)
	auditHandler := auditpkg.NewHandler(auditpkg.NewRepository(db), sessionStore)
	settingHandler := settingpkg.NewHandler(settingpkg.NewRepository(db), sessionStore, cfg.UploadDir, maxUploadBytes(cfg.MaxUploadMB))
	authHandler := auth.NewHandler(authRepo, sessionStore)
	customerHandler := customer.NewHandler(customer.NewRepository(db), sessionStore)
	expenseHandler := expense.NewHandler(expense.NewRepository(db), sessionStore)
	dashboardHandler := dashboard.NewHandler(dashboard.NewRepository(db), sessionStore)
	orderHandler := order.NewHandler(order.NewRepository(db), sessionStore)
	paymentHandler := payment.NewHandler(payment.NewRepository(db), sessionStore)
	pickupHandler := pickup.NewHandler(pickup.NewRepository(db), sessionStore, cfg.UploadDir, maxUploadBytes(cfg.MaxUploadMB))
	reportHandler := reportpkg.NewHandler(reportpkg.NewRepository(db), sessionStore)
	serviceHandler := services.NewHandler(services.NewRepository(db), sessionStore)
	userHandler := userpkg.NewHandler(userpkg.NewRepository(db), sessionStore, cfg.UploadDir, maxUploadBytes(cfg.MaxUploadMB))
	notificationHandler := notification.NewHandler(notification.NewRepository(db), sessionStore)

	router := chi.NewRouter()
	router.Use(chimiddleware.RequestID)
	router.Use(chimiddleware.RealIP)
	router.Use(chimiddleware.Recoverer)
	router.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{
			"http://localhost:5173",
			"http://127.0.0.1:5173",
			"http://localhost:5174",
			"http://127.0.0.1:5174",
			"http://localhost:5175",
			"http://127.0.0.1:5175",
		},
		AllowedMethods:   []string{http.MethodGet, http.MethodPost, http.MethodPatch, http.MethodDelete, http.MethodOptions},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	router.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{
			"status": "ok",
			"env":    cfg.AppEnv,
		})
	})

	router.Route("/api/v1/auth", func(r chi.Router) {
		r.Post("/login", authHandler.Login)
		r.Post("/logout", authHandler.Logout)
		r.Get("/me", authHandler.Me)
	})

	// Routes any signed-in user (OWNER or STAFF) may reach. RequireAuth resolves
	// the actor once and puts it in the request context.
	router.Group(func(r chi.Router) {
		r.Use(auth.RequireAuth(sessionStore, authRepo))

		r.Get("/api/v1/users", userHandler.List)
		r.Get("/api/v1/users/{username}", userHandler.Detail)
		r.Post("/api/v1/users/{username}/avatar", userHandler.UploadAvatar)
		r.Patch("/api/v1/users/{username}/notification-settings", userHandler.UpdatePreferences)

		r.Get("/api/v1/notifications", notificationHandler.List)
		r.Patch("/api/v1/notifications/read", notificationHandler.MarkAllAsRead)

		r.Get("/api/v1/reports/overview", reportHandler.Overview)
		r.Get("/api/v1/reports/detail", reportHandler.Detail)
		r.Get("/api/v1/reports/export", reportHandler.ExportCSV)

		r.Get("/api/v1/settings/profile", settingHandler.GetProfile)

		r.Get("/api/v1/services", serviceHandler.List)
		r.Get("/api/v1/services/{code}", serviceHandler.Detail)

		r.Get("/api/v1/expenses", expenseHandler.List)
		r.Post("/api/v1/expenses", expenseHandler.Create)

		r.Get("/api/v1/dashboard", dashboardHandler.Overview)
		r.Get("/api/v1/customers/suggestions", customerHandler.Suggestions)
		r.Get("/api/v1/customers/{id}", customerHandler.Detail)
		r.Patch("/api/v1/customers/{id}", customerHandler.Update)
		r.Get("/api/v1/customers", customerHandler.List)
		r.Get("/api/v1/orders", orderHandler.List)
		r.Post("/api/v1/orders", orderHandler.Create)
		r.Patch("/api/v1/orders/bulk-status", orderHandler.BulkUpdateStatus)
		r.Get("/api/v1/orders/{code}", orderHandler.Detail)
		r.Patch("/api/v1/orders/{code}", orderHandler.Update)
		r.Post("/api/v1/orders/{code}/payments/settle", paymentHandler.SettleOrder)
		r.Patch("/api/v1/orders/{code}/status", orderHandler.UpdateStatus)
		r.Get("/api/v1/orders/{code}/pickup", pickupHandler.Detail)
		r.Post("/api/v1/orders/{code}/pickup", pickupHandler.Create)
		r.Get("/api/v1/payments", paymentHandler.List)
		r.Get("/api/v1/payments/{code}", paymentHandler.Detail)
	})

	// Owner-only routes: account management, shop configuration, money
	// corrections and the audit trail.
	router.Group(func(r chi.Router) {
		r.Use(auth.RequireAuth(sessionStore, authRepo))
		r.Use(auth.RequireOwner)

		r.Post("/api/v1/users", userHandler.Create)
		r.Patch("/api/v1/users/{username}", userHandler.Update)
		r.Post("/api/v1/users/{username}/reset-password", userHandler.ResetPassword)

		r.Get("/api/v1/audit-logs", auditHandler.List)
		r.Get("/api/v1/audit-logs/{id}", auditHandler.Detail)

		r.Patch("/api/v1/settings/profile", settingHandler.UpdateProfile)
		r.Post("/api/v1/settings/profile/logo", settingHandler.UploadLogo)
		r.Get("/api/v1/settings/backup", settingHandler.DownloadBackup)

		r.Patch("/api/v1/services/{code}", serviceHandler.Update)

		r.Patch("/api/v1/expenses/{id}", expenseHandler.Update)
		r.Delete("/api/v1/expenses/{id}", expenseHandler.Delete)

		r.Delete("/api/v1/orders/{code}", orderHandler.Delete)
		r.Patch("/api/v1/payments/{code}", paymentHandler.Update)
		r.Delete("/api/v1/payments/{code}", paymentHandler.Delete)
	})

	router.Handle("/uploads/*", http.StripPrefix("/uploads/", http.FileServer(http.Dir(cfg.UploadDir))))

	server := &http.Server{
		Addr:              ":" + cfg.AppPort,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Info().Str("addr", server.Addr).Msg("server started")
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal().Err(err).Msg("server failed")
		}
	}()

	shutdownCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	<-shutdownCtx.Done()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Error().Err(err).Msg("server shutdown failed")
		return
	}

	log.Info().Msg("server stopped")
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Error().Err(err).Msg("failed to write response")
	}
}

func maxUploadBytes(value string) int64 {
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil || parsed <= 0 {
		parsed = 2
	}

	return parsed << 20
}
