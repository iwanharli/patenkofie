CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- e.g., 'SECURITY', 'ORDER_UPDATE', 'DAILY_REPORT'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_id_created_at ON notifications(user_id, created_at DESC);

ALTER TABLE users ADD COLUMN notification_preferences JSONB DEFAULT '{"security": true, "order_updates": true, "daily_report": true}';
