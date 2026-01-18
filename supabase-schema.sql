-- RANSXM Key Management Database Schema
-- Run this in Supabase SQL Editor to create tables

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Keys table
CREATE TABLE IF NOT EXISTS keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key_value VARCHAR(50) UNIQUE NOT NULL,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    hwid VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'expired', 'banned')),
    expires_at TIMESTAMP WITH TIME ZONE,
    max_uses INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,
    last_used TIMESTAMP WITH TIME ZONE,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage logs table
CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key_id UUID REFERENCES keys(id) ON DELETE CASCADE,
    ip_address VARCHAR(45),
    hwid VARCHAR(255),
    game_id VARCHAR(50),
    executor VARCHAR(100),
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_keys_key_value ON keys(key_value);
CREATE INDEX IF NOT EXISTS idx_keys_status ON keys(status);
CREATE INDEX IF NOT EXISTS idx_keys_owner ON keys(owner_id);
CREATE INDEX IF NOT EXISTS idx_logs_key_id ON usage_logs(key_id);
CREATE INDEX IF NOT EXISTS idx_logs_used_at ON usage_logs(used_at);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- Policies (allow service role full access)
CREATE POLICY "Service role has full access to users" ON users
    FOR ALL USING (true);

CREATE POLICY "Service role has full access to keys" ON keys
    FOR ALL USING (true);

CREATE POLICY "Service role has full access to logs" ON usage_logs
    FOR ALL USING (true);

