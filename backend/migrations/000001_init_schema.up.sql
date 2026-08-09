CREATE TABLE IF NOT EXISTS schema_migrations (
    version BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    username VARCHAR(80) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('OWNER', 'STAFF')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE customers (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    phone VARCHAR(30),
    address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX customers_phone_idx ON customers (phone);
CREATE INDEX customers_name_idx ON customers (name);

CREATE TABLE services (
    id SMALLSERIAL PRIMARY KEY,
    code VARCHAR(5) NOT NULL UNIQUE CHECK (code IN ('G', 'R', 'GR')),
    name VARCHAR(120) NOT NULL,
    price_per_kg BIGINT NOT NULL CHECK (price_per_kg > 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    updated_by BIGINT REFERENCES users (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER services_set_updated_at
BEFORE UPDATE ON services
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    order_code VARCHAR(40) NOT NULL UNIQUE,
    customer_id BIGINT NOT NULL REFERENCES customers (id),
    service_id SMALLINT NOT NULL REFERENCES services (id),
    weight_kg NUMERIC(10, 3) NOT NULL CHECK (weight_kg > 0),
    price_per_kg BIGINT NOT NULL CHECK (price_per_kg > 0),
    total_amount BIGINT NOT NULL CHECK (total_amount >= 0),
    paid_amount BIGINT NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    payment_status VARCHAR(20) NOT NULL CHECK (payment_status IN ('BELUM_BAYAR', 'DP', 'LUNAS')),
    order_status VARCHAR(20) NOT NULL CHECK (order_status IN ('MENUNGGU', 'DIPROSES', 'SIAP_DIAMBIL', 'SELESAI', 'DIBATALKAN')),
    roast_level VARCHAR(30) CHECK (roast_level IS NULL OR roast_level IN ('LIGHT', 'MEDIUM', 'DARK', 'CUSTOM')),
    grind_level VARCHAR(50),
    notes TEXT,
    created_by BIGINT NOT NULL REFERENCES users (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (paid_amount <= total_amount)
);

CREATE INDEX orders_customer_id_idx ON orders (customer_id);
CREATE INDEX orders_service_id_idx ON orders (service_id);
CREATE INDEX orders_order_status_idx ON orders (order_status);
CREATE INDEX orders_payment_status_idx ON orders (payment_status);
CREATE INDEX orders_created_at_idx ON orders (created_at);

CREATE TRIGGER orders_set_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE payments (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders (id) ON DELETE RESTRICT,
    payment_type VARCHAR(30) NOT NULL CHECK (payment_type IN ('FULL_PAYMENT', 'DOWN_PAYMENT', 'REMAINING_PAYMENT')),
    amount BIGINT NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(20) NOT NULL DEFAULT 'CASH' CHECK (payment_method = 'CASH'),
    received_by BIGINT NOT NULL REFERENCES users (id),
    paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT
);

CREATE INDEX payments_order_id_idx ON payments (order_id);
CREATE INDEX payments_paid_at_idx ON payments (paid_at);
CREATE INDEX payments_received_by_idx ON payments (received_by);

CREATE TABLE pickups (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE REFERENCES orders (id) ON DELETE RESTRICT,
    recipient_name VARCHAR(160) NOT NULL,
    recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('CUSTOMER', 'REPRESENTATIVE')),
    recipient_phone VARCHAR(30),
    photo_path TEXT NOT NULL,
    handed_over_by BIGINT NOT NULL REFERENCES users (id),
    picked_up_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT
);

CREATE INDEX pickups_picked_up_at_idx ON pickups (picked_up_at);

CREATE TABLE order_status_logs (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders (id) ON DELETE RESTRICT,
    previous_status VARCHAR(20) CHECK (previous_status IS NULL OR previous_status IN ('MENUNGGU', 'DIPROSES', 'SIAP_DIAMBIL', 'SELESAI', 'DIBATALKAN')),
    new_status VARCHAR(20) NOT NULL CHECK (new_status IN ('MENUNGGU', 'DIPROSES', 'SIAP_DIAMBIL', 'SELESAI', 'DIBATALKAN')),
    changed_by BIGINT NOT NULL REFERENCES users (id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT
);

CREATE INDEX order_status_logs_order_id_idx ON order_status_logs (order_id);
CREATE INDEX order_status_logs_changed_at_idx ON order_status_logs (changed_at);

CREATE TABLE daily_sequences (
    business_date DATE NOT NULL,
    service_code VARCHAR(5) NOT NULL CHECK (service_code IN ('G', 'R', 'GR')),
    next_number INTEGER NOT NULL CHECK (next_number > 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (business_date, service_code)
);

CREATE TRIGGER daily_sequences_set_updated_at
BEFORE UPDATE ON daily_sequences
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_by BIGINT REFERENCES users (id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER app_settings_set_updated_at
BEFORE UPDATE ON app_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_id BIGINT REFERENCES users (id),
    action VARCHAR(80) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_actor_id_idx ON audit_logs (actor_id);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id);
CREATE INDEX audit_logs_created_at_idx ON audit_logs (created_at);

INSERT INTO services (code, name, price_per_kg)
VALUES
    ('G', 'Giling saja', 5000),
    ('R', 'Roasting saja', 10000),
    ('GR', 'Giling + roasting', 12000)
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_settings (key, value, description)
VALUES
    ('business_name', 'Patenote', 'Nama usaha yang ditampilkan pada aplikasi'),
    ('max_upload_mb', '2', 'Batas ukuran upload foto pengambilan dalam MB'),
    ('timezone', 'Asia/Jakarta', 'Zona waktu tampilan aplikasi')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (version, name)
VALUES (1, 'init_schema')
ON CONFLICT (version) DO NOTHING;
