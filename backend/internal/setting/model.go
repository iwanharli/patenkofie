package setting

import "time"

type BusinessProfile struct {
	BusinessName    string    `json:"business_name"`
	BusinessAddress string    `json:"business_address"`
	BusinessPhone   string    `json:"business_phone"`
	ReceiptFooter   string    `json:"receipt_footer"`
	LogoURL         string    `json:"logo_url"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type UpdateBusinessProfileInput struct {
	ActorID         int64
	BusinessName    string
	BusinessAddress string
	BusinessPhone   string
	ReceiptFooter   string
}
