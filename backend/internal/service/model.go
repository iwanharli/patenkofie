package service

import "time"

type Service struct {
	ID            int16
	Code          string
	Name          string
	PricePerKg    int64
	IsActive      bool
	UpdatedByName *string
	UpdatedAt     time.Time
}
