-- Add missing tables for Turnkey integration

-- Create turnkey_wallets table
CREATE TABLE IF NOT EXISTS turnkey_wallets (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL,
    turnkey_sub_org_id TEXT NOT NULL,
    turnkey_key_id TEXT,
    public_key TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(telegram_id, turnkey_sub_org_id)
);

-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
    telegram_id BIGINT PRIMARY KEY,
    public_key TEXT,
    referral_code TEXT,
    turnkey_user_id TEXT,
    turnkey_session_id TEXT,
    temp_api_public_key TEXT,
    temp_api_private_key TEXT,
    session_expiry TIMESTAMP,
    user_email TEXT,
    kms_encrypted_session_key TEXT,
    kms_key_id TEXT
);

-- Create referrals table
CREATE TABLE IF NOT EXISTS referrals (
    id SERIAL PRIMARY KEY,
    referee_id BIGINT NOT NULL,
    referrer_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(referee_id, referrer_id)
);

-- Create founders table
CREATE TABLE IF NOT EXISTS founders (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_turnkey_wallets_telegram_id ON turnkey_wallets(telegram_id);
CREATE INDEX IF NOT EXISTS idx_turnkey_wallets_sub_org_id ON turnkey_wallets(turnkey_sub_org_id);
CREATE INDEX IF NOT EXISTS idx_turnkey_wallets_active ON turnkey_wallets(is_active) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_referrals_referee_id ON referrals(referee_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);





