DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS app_settings;
DROP TABLE IF EXISTS daily_sequences;
DROP TABLE IF EXISTS order_status_logs;
DROP TABLE IF EXISTS pickups;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS users;

DROP FUNCTION IF EXISTS set_updated_at();

DELETE FROM schema_migrations WHERE version = 1;
DROP TABLE IF EXISTS schema_migrations;
