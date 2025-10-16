CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    privy_user_id VARCHAR(100) UNIQUE NOT NULL,
    phone_number VARCHAR(20) UNIQUE,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

CREATE TABLE wallets (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    address VARCHAR(42) UNIQUE NOT NULL,
    auth_method VARCHAR(20) NOT NULL,
    auth_value VARCHAR(255),
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE deployed_tokens (
    id SERIAL PRIMARY KEY,
    address VARCHAR(42) UNIQUE NOT NULL,
    name VARCHAR(100),
    symbol VARCHAR(10),
    decimals INT DEFAULT 2,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE bank_connections (
    id SERIAL PRIMARY KEY,
    token_address VARCHAR(42) NOT NULL,
    pluggy_item_id VARCHAR(100),
    pluggy_account_id VARCHAR(100),
    bank_name VARCHAR(100),
    balance_brl BIGINT,
    last_updated TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE whatsapp_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) UNIQUE NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    state JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_wallets_phone ON wallets(phone);
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_whatsapp_phone ON whatsapp_sessions(phone_number);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_whatsapp_sessions_updated_at
BEFORE UPDATE ON whatsapp_sessions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Authentication tokens for auditability
CREATE TABLE IF NOT EXISTS auth_tokens (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL,
    token VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    CONSTRAINT uq_auth_token UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_phone ON auth_tokens(phone_number);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires ON auth_tokens(expires_at);

-- Pending transfers for recipients not yet linked
CREATE TABLE IF NOT EXISTS pending_transfers (
    id SERIAL PRIMARY KEY,
    token_address VARCHAR(42) NOT NULL,
    amount NUMERIC(78, 0) NOT NULL,
    sender_phone VARCHAR(20) NOT NULL,
    sender_address VARCHAR(42) NOT NULL,
    recipient_phone VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING | COMPLETED | FAILED
    tx_hash VARCHAR(80),
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pending_recipient ON pending_transfers(recipient_phone, status);
