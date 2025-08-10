-- Add Turnkey API public key column to turnkey_wallets table
-- This separates Stellar wallet public keys from Turnkey API public keys

-- Add the new column
ALTER TABLE turnkey_wallets 
ADD COLUMN IF NOT EXISTS turnkey_api_public_key TEXT;

-- Add index for the new column
CREATE INDEX IF NOT EXISTS idx_turnkey_wallets_api_key ON turnkey_wallets(turnkey_api_public_key);

-- Add comment to clarify the distinction
COMMENT ON COLUMN turnkey_wallets.public_key IS 'Stellar wallet public key (starts with G)';
COMMENT ON COLUMN turnkey_wallets.turnkey_api_public_key IS 'Turnkey API public key (starts with 02 or 03)';
