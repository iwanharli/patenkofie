package config

import (
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	AppEnv        string
	AppPort       string
	AppTimezone   string
	DatabaseURL   string
	SessionSecret string
	UploadDir     string
	MaxUploadMB   string
	FrontendDist  string
}

func Load() Config {
	_ = godotenv.Load()

	return Config{
		AppEnv:        getEnv("APP_ENV", "development"),
		AppPort:       getEnv("APP_PORT", "8080"),
		AppTimezone:   getEnv("APP_TIMEZONE", "Asia/Jakarta"),
		DatabaseURL:   getEnv("DATABASE_URL", ""),
		SessionSecret: getEnv("SESSION_SECRET", ""),
		UploadDir:     getEnv("UPLOAD_DIR", "./uploads"),
		MaxUploadMB:   getEnv("MAX_UPLOAD_MB", "8"),
		FrontendDist:  getEnv("FRONTEND_DIST", "../frontend/dist"),
	}
}

func getEnv(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	return value
}
