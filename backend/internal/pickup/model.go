package pickup

import "time"

type Pickup struct {
	ID             int64
	OrderID        int64
	OrderCode      string
	RecipientName  string
	RecipientType  string
	RecipientPhone *string
	PhotoPath      string
	HandedOverBy   int64
	HandedOverName *string
	PickedUpAt     time.Time
	Notes          *string
}

type CreatePickupInput struct {
	OrderCode      string
	RecipientName  string
	RecipientType  string
	RecipientPhone *string
	PhotoPath      string
	HandedOverBy   int64
	Notes          *string
}
