-- KMS Integration Schema Updates
-- Add to existing users table

-- Add KMS encrypted session key column
ALTER TABLE users ADD COLUMN IF NOT EXISTS kms_encrypted_session_key TEXT;

-- Add KMS key ID for tracking which key was used
ALTER TABLE users ADD COLUMN IF NOT EXISTS kms_key_id TEXT;

-- Add session key creation timestamp
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_created_at TIMESTAMPTZ DEFAULT NOW();

-- Add session key version for future key rotation
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_key_version INTEGER DEFAULT 1;

-- Create index for session expiry queries
CREATE INDEX IF NOT EXISTS idx_session_expiry ON users(session_expiry) WHERE session_expiry IS NOT NULL;

-- Create index for KMS key tracking
CREATE INDEX IF NOT EXISTS idx_kms_key_id ON users(kms_key_id) WHERE kms_key_id IS NOT NULL; 