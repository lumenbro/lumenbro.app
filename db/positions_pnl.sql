-- Positions and P&L Tracking System
-- Tracks user positions, trades, and calculates profit/loss

-- User positions table (current holdings)
CREATE TABLE IF NOT EXISTS user_positions (
    id BIGSERIAL PRIMARY KEY,
    telegram_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
    asset_code VARCHAR(20) NOT NULL,
    asset_issuer VARCHAR(255),
    quantity DECIMAL(20,7) NOT NULL DEFAULT 0,
    avg_buy_price DECIMAL(20,7), -- Average price in XLM
    total_invested DECIMAL(20,7), -- Total XLM invested
    current_value DECIMAL(20,7), -- Current value in XLM
    unrealized_pnl DECIMAL(20,7), -- Unrealized profit/loss in XLM
    pnl_percentage DECIMAL(10,4), -- P&L as percentage
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(telegram_id, asset_code, asset_issuer)
);

-- Individual trades table (detailed trade history)
CREATE TABLE IF NOT EXISTS user_trades (
    id BIGSERIAL PRIMARY KEY,
    telegram_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
    trade_type VARCHAR(20) NOT NULL, -- 'buy', 'sell', 'swap_in', 'swap_out'
    asset_code VARCHAR(20) NOT NULL,
    asset_issuer VARCHAR(255),
    quantity DECIMAL(20,7) NOT NULL,
    price_xlm DECIMAL(20,7) NOT NULL, -- Price in XLM at time of trade
    total_xlm DECIMAL(20,7) NOT NULL, -- Total XLM value
    tx_hash TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    position_id BIGINT REFERENCES user_positions(id) ON DELETE CASCADE,
    related_trade_id BIGINT REFERENCES user_trades(id), -- For swaps
    fee_amount DECIMAL(20,7) DEFAULT 0,
    notes TEXT
);

-- Asset price history (for P&L calculations)
CREATE TABLE IF NOT EXISTS asset_prices (
    id BIGSERIAL PRIMARY KEY,
    asset_code VARCHAR(20) NOT NULL,
    asset_issuer VARCHAR(255),
    price_xlm DECIMAL(20,7) NOT NULL,
    volume_24h DECIMAL(20,7),
    source VARCHAR(50) DEFAULT 'stellar_dex', -- 'stellar_dex', 'external_api'
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(asset_code, asset_issuer, timestamp)
);

-- P&L snapshots (for historical tracking)
CREATE TABLE IF NOT EXISTS pnl_snapshots (
    id BIGSERIAL PRIMARY KEY,
    telegram_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
    total_portfolio_value DECIMAL(20,7) NOT NULL,
    total_invested DECIMAL(20,7) NOT NULL,
    total_unrealized_pnl DECIMAL(20,7) NOT NULL,
    total_realized_pnl DECIMAL(20,7) NOT NULL DEFAULT 0,
    pnl_percentage DECIMAL(10,4) NOT NULL,
    snapshot_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(telegram_id, snapshot_date)
);

-- Realized P&L tracking (when positions are closed)
CREATE TABLE IF NOT EXISTS realized_pnl (
    id BIGSERIAL PRIMARY KEY,
    telegram_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
    asset_code VARCHAR(20) NOT NULL,
    asset_issuer VARCHAR(255),
    buy_trade_id BIGINT REFERENCES user_trades(id),
    sell_trade_id BIGINT REFERENCES user_trades(id),
    quantity DECIMAL(20,7) NOT NULL,
    buy_price DECIMAL(20,7) NOT NULL,
    sell_price DECIMAL(20,7) NOT NULL,
    realized_pnl DECIMAL(20,7) NOT NULL,
    pnl_percentage DECIMAL(10,4) NOT NULL,
    holding_period_days INTEGER,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_positions_telegram_id ON user_positions(telegram_id);
CREATE INDEX IF NOT EXISTS idx_user_positions_asset ON user_positions(asset_code, asset_issuer);
CREATE INDEX IF NOT EXISTS idx_user_positions_pnl ON user_positions(unrealized_pnl DESC);

CREATE INDEX IF NOT EXISTS idx_user_trades_telegram_id ON user_trades(telegram_id);
CREATE INDEX IF NOT EXISTS idx_user_trades_asset ON user_trades(asset_code, asset_issuer);
CREATE INDEX IF NOT EXISTS idx_user_trades_timestamp ON user_trades(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_trades_type ON user_trades(trade_type);

CREATE INDEX IF NOT EXISTS idx_asset_prices_asset ON asset_prices(asset_code, asset_issuer);
CREATE INDEX IF NOT EXISTS idx_asset_prices_timestamp ON asset_prices(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_pnl_snapshots_telegram_id ON pnl_snapshots(telegram_id);
CREATE INDEX IF NOT EXISTS idx_pnl_snapshots_date ON pnl_snapshots(snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_realized_pnl_telegram_id ON realized_pnl(telegram_id);
CREATE INDEX IF NOT EXISTS idx_realized_pnl_timestamp ON realized_pnl(timestamp DESC);

-- Functions for P&L calculations

-- Function to update position after a trade
CREATE OR REPLACE FUNCTION update_position_after_trade(
    p_telegram_id BIGINT,
    p_asset_code VARCHAR(20),
    p_asset_issuer VARCHAR(255),
    p_trade_type VARCHAR(20),
    p_quantity DECIMAL(20,7),
    p_price_xlm DECIMAL(20,7),
    p_total_xlm DECIMAL(20,7)
) RETURNS VOID AS $$
DECLARE
    v_position_id BIGINT;
    v_existing_quantity DECIMAL(20,7);
    v_existing_avg_price DECIMAL(20,7);
    v_existing_invested DECIMAL(20,7);
    v_new_quantity DECIMAL(20,7);
    v_new_avg_price DECIMAL(20,7);
    v_new_invested DECIMAL(20,7);
BEGIN
    -- Get or create position
    SELECT id, quantity, avg_buy_price, total_invested 
    INTO v_position_id, v_existing_quantity, v_existing_avg_price, v_existing_invested
    FROM user_positions 
    WHERE telegram_id = p_telegram_id 
    AND asset_code = p_asset_code 
    AND asset_issuer = p_asset_issuer;
    
    IF v_position_id IS NULL THEN
        -- Create new position
        INSERT INTO user_positions (telegram_id, asset_code, asset_issuer, quantity, avg_buy_price, total_invested)
        VALUES (p_telegram_id, p_asset_code, p_asset_issuer, p_quantity, p_price_xlm, p_total_xlm)
        RETURNING id INTO v_position_id;
    ELSE
        -- Update existing position
        IF p_trade_type = 'buy' OR p_trade_type = 'swap_in' THEN
            -- Adding to position
            v_new_quantity = v_existing_quantity + p_quantity;
            v_new_invested = v_existing_invested + p_total_xlm;
            v_new_avg_price = v_new_invested / v_new_quantity;
        ELSE
            -- Selling from position
            v_new_quantity = v_existing_quantity - p_quantity;
            v_new_invested = v_existing_invested * (v_new_quantity / v_existing_quantity);
            v_new_avg_price = v_existing_avg_price; -- Keep same avg price
        END IF;
        
        UPDATE user_positions 
        SET quantity = v_new_quantity,
            avg_buy_price = v_new_avg_price,
            total_invested = v_new_invested,
            last_updated = CURRENT_TIMESTAMP
        WHERE id = v_position_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate unrealized P&L for a position
CREATE OR REPLACE FUNCTION calculate_position_pnl(
    p_position_id BIGINT,
    p_current_price DECIMAL(20,7)
) RETURNS VOID AS $$
DECLARE
    v_quantity DECIMAL(20,7);
    v_avg_price DECIMAL(20,7);
    v_total_invested DECIMAL(20,7);
    v_current_value DECIMAL(20,7);
    v_unrealized_pnl DECIMAL(20,7);
    v_pnl_percentage DECIMAL(10,4);
BEGIN
    SELECT quantity, avg_buy_price, total_invested
    INTO v_quantity, v_avg_price, v_total_invested
    FROM user_positions
    WHERE id = p_position_id;
    
    IF v_quantity > 0 THEN
        v_current_value = v_quantity * p_current_price;
        v_unrealized_pnl = v_current_value - v_total_invested;
        v_pnl_percentage = CASE 
            WHEN v_total_invested > 0 THEN (v_unrealized_pnl / v_total_invested) * 100
            ELSE 0
        END;
        
        UPDATE user_positions
        SET current_value = v_current_value,
            unrealized_pnl = v_unrealized_pnl,
            pnl_percentage = v_pnl_percentage,
            last_updated = CURRENT_TIMESTAMP
        WHERE id = p_position_id;
    END IF;
END;
$$ LANGUAGE plpgsql;
