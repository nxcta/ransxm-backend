-- Migration: Add Role System & Key Validation
-- Run this in your Supabase SQL Editor

-- 1. Update users table role constraint to include super_admin
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin', 'super_admin'));

-- 2. Add key_id column to users (links user to their key)
ALTER TABLE users ADD COLUMN IF NOT EXISTS key_id UUID REFERENCES keys(id) ON DELETE SET NULL;

-- 3. Add validation fields to keys table
ALTER TABLE keys ADD COLUMN IF NOT EXISTS skip_validation BOOLEAN DEFAULT FALSE;
ALTER TABLE keys ADD COLUMN IF NOT EXISTS validated BOOLEAN DEFAULT FALSE;
ALTER TABLE keys ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP WITH TIME ZONE;

-- 4. Update existing admin users to super_admin
UPDATE users SET role = 'super_admin' WHERE role = 'admin';

-- 5. Set skip_validation = true for RANSXM tier keys (they never need validation)
UPDATE keys SET skip_validation = TRUE WHERE tier = 'ransxm';

-- 6. Mark existing keys as validated (legacy keys)
UPDATE keys SET validated = TRUE, validated_at = NOW() WHERE owner_id IS NOT NULL;

