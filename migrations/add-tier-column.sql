-- Migration: Add tier column to keys table
-- Run this in your Supabase SQL Editor

-- Add tier column with default value 'basic'
ALTER TABLE keys 
ADD COLUMN IF NOT EXISTS tier VARCHAR(20) DEFAULT 'basic' 
CHECK (tier IN ('basic', 'premium', 'ransxm'));

-- Update existing keys to have 'basic' tier if null
UPDATE keys SET tier = 'basic' WHERE tier IS NULL;

