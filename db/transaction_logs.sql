-- Trades table for volume tracking (mirrors Python bot)
CREATE TABLE IF NOT EXISTS trades (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    xlm_volume DECIMAL(20,7) NOT NULL,
    tx_hash TEXT UNIQUE NOT NULL,
    action_type TEXT DEFAULT 'payment',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fees table for fee tracking (mirrors Python bot)
CREATE TABLE IF NOT EXISTS fees (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL,
    action_type TEXT NOT NULL,
    amount DECIMAL(20,7) NOT NULL,
    fee DECIMAL(20,7) NOT NULL,
    tx_hash TEXT UNIQUE NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rewards table for referral payouts (mirrors Python bot)
CREATE TABLE IF NOT EXISTS rewards (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    amount DECIMAL(20,7) NOT NULL,
    status TEXT DEFAULT 'unpaid',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Referrals table (mirrors Python bot)
CREATE TABLE IF NOT EXISTS referrals (
    referrer_id BIGINT REFERENCES users(telegram_id),
    referee_id BIGINT REFERENCES users(telegram_id),
    PRIMARY KEY (referrer_id, referee_id)
);

-- Founders table (mirrors Python bot)
CREATE TABLE IF NOT EXISTS founders (
    telegram_id BIGINT PRIMARY KEY REFERENCES users(telegram_id)
);

-- Indexes for performance (mirrors Python bot)
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);
CREATE INDEX IF NOT EXISTS idx_trades_action_type ON trades(action_type);

CREATE INDEX IF NOT EXISTS idx_fees_telegram_id ON fees(telegram_id);
CREATE INDEX IF NOT EXISTS idx_fees_timestamp ON fees(timestamp);
CREATE INDEX IF NOT EXISTS idx_fees_action_type ON fees(action_type);

CREATE INDEX IF NOT EXISTS idx_rewards_user_id ON rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_rewards_status ON rewards(status);
CREATE INDEX IF NOT EXISTS idx_rewards_timestamp ON rewards(timestamp);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON referrals(referee_id);

-- Fee collection wallet for tracking
CREATE TABLE IF NOT EXISTS fee_collection (
    id BIGSERIAL PRIMARY KEY,
    telegram_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
    transaction_id BIGINT REFERENCES transaction_logs(id) ON DELETE CASCADE,
    fee_amount DECIMAL(20,7) NOT NULL,
    asset VARCHAR(20) NOT NULL,
    collection_method VARCHAR(50) NOT NULL, -- 'deducted', 'separate_payment', 'swap_fee'
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'collected', 'failed'
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- DApp connection logs for authentication tracking
CREATE TABLE IF NOT EXISTS dapp_connections (
    id BIGSERIAL PRIMARY KEY,
    telegram_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
    dapp_domain VARCHAR(255) NOT NULL,
    dapp_name VARCHAR(255),
    connection_type VARCHAR(50) NOT NULL, -- 'connect', 'sign_transaction', 'sign_message'
    signing_method VARCHAR(50) NOT NULL, -- 'client_side_turnkey', 'server_side_session'
    status VARCHAR(20) DEFAULT 'connected', -- 'connected', 'disconnected', 'failed'
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for DApp connections
CREATE INDEX IF NOT EXISTS idx_dapp_connections_telegram_id ON dapp_connections(telegram_id);
CREATE INDEX IF NOT EXISTS idx_dapp_connections_domain ON dapp_connections(dapp_domain);
CREATE INDEX IF NOT EXISTS idx_dapp_connections_timestamp ON dapp_connections(timestamp);
