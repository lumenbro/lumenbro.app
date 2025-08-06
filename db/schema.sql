-- Stellar Chart Data Database Schema
-- Requires PostgreSQL with TimescaleDB extension

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create trade_aggregations hypertable
CREATE TABLE IF NOT EXISTS trade_aggregations (
    timestamp TIMESTAMPTZ NOT NULL,
    base_asset TEXT NOT NULL,
    counter_asset TEXT NOT NULL,
    resolution INTERVAL NOT NULL,
    open DECIMAL(20,8) NOT NULL,
    high DECIMAL(20,8) NOT NULL,
    low DECIMAL(20,8) NOT NULL,
    close DECIMAL(20,8) NOT NULL,
    base_volume DECIMAL(20,8) NOT NULL,
    counter_volume DECIMAL(20,8) NOT NULL,
    trade_count INTEGER NOT NULL,
    UNIQUE(timestamp, base_asset, counter_asset, resolution)
);

-- Convert to hypertable
SELECT create_hypertable('trade_aggregations', 'timestamp', if_not_exists => TRUE);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_asset_pair ON trade_aggregations (base_asset, counter_asset);
CREATE INDEX IF NOT EXISTS idx_resolution ON trade_aggregations (resolution);
CREATE INDEX IF NOT EXISTS idx_timestamp ON trade_aggregations (timestamp DESC);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_asset_pair_resolution ON trade_aggregations (base_asset, counter_asset, resolution);

-- Create table for tracking sync status
CREATE TABLE IF NOT EXISTS sync_status (
    id SERIAL PRIMARY KEY,
    asset_pair TEXT NOT NULL,
    resolution INTERVAL NOT NULL,
    last_synced TIMESTAMPTZ,
    last_cursor TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(asset_pair, resolution)
);

-- Create table for popular asset pairs (for caching optimization)
CREATE TABLE IF NOT EXISTS popular_pairs (
    id SERIAL PRIMARY KEY,
    base_asset TEXT NOT NULL,
    counter_asset TEXT NOT NULL,
    popularity_score INTEGER DEFAULT 0,
    last_accessed TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(base_asset, counter_asset)
);

-- Insert some common Stellar asset pairs
INSERT INTO popular_pairs (base_asset, counter_asset, popularity_score) VALUES
('XLM', 'USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN', 100)
ON CONFLICT (base_asset, counter_asset) DO NOTHING;

-- Create function to update last_accessed timestamp
CREATE OR REPLACE FUNCTION update_last_accessed()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_accessed = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for popular_pairs
CREATE TRIGGER update_popular_pairs_timestamp
    BEFORE UPDATE ON popular_pairs
    FOR EACH ROW
    EXECUTE FUNCTION update_last_accessed(); 