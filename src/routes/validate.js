const express = require('express');
const supabase = require('../db/supabase');

const router = express.Router();

// Validate key (called from Lua script)
router.post('/', async (req, res) => {
    try {
        const { key, hwid, game_id, executor } = req.body;
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        
        if (!key) {
            return res.json({ 
                valid: false, 
                error: 'No key provided' 
            });
        }
        
        // Find the key
        const { data: keyData, error } = await supabase
            .from('keys')
            .select('*')
            .eq('key_value', key.toUpperCase().trim())
            .single();
        
        if (error || !keyData) {
            return res.json({ 
                valid: false, 
                error: 'Invalid key' 
            });
        }
        
        // Check if key is active
        if (keyData.status !== 'active') {
            return res.json({ 
                valid: false, 
                error: `Key is ${keyData.status}` 
            });
        }
        
        // Check expiration
        if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
            // Update key status to expired
            await supabase
                .from('keys')
                .update({ status: 'expired' })
                .eq('id', keyData.id);
            
            return res.json({ 
                valid: false, 
                error: 'Key has expired' 
            });
        }
        
        // === VALIDATION CHECK ===
        // Keys that DON'T need validation:
        // 1. RANSXM tier keys (always work)
        // 2. Keys with skip_validation = true (giveaways, etc.)
        // 3. Keys already validated by user registration
        
        const needsValidation = !keyData.skip_validation && keyData.tier !== 'ransxm';
        
        if (needsValidation && !keyData.validated) {
            return res.json({
                valid: false,
                error: 'Key requires registration. Please register at ransxm.com to activate your key.',
                requires_registration: true
            });
        }
        
        // Check HWID first
        let hwidMatches = false;
        let isNewHwid = false;
        
        if (hwid) {
            if (keyData.hwid) {
                // Key has HWID locked
                if (keyData.hwid === hwid) {
                    // Same device - allow access (bypass uses check)
                    hwidMatches = true;
                } else {
                    // Different device - reject
                    return res.json({ 
                        valid: false, 
                        error: 'Key is locked to another device' 
                    });
                }
            } else {
                // No HWID locked yet - this is a new activation
                isNewHwid = true;
            }
        }
        
        // Check max uses (only if HWID doesn't match - new device or first use)
        if (!hwidMatches && keyData.max_uses > 0 && keyData.current_uses >= keyData.max_uses) {
            return res.json({ 
                valid: false, 
                error: 'Key has reached maximum uses' 
            });
        }
        
        // Lock HWID if this is a new activation
        if (isNewHwid) {
            await supabase
                .from('keys')
                .update({ hwid })
                .eq('id', keyData.id);
        }
        
        // Update usage count (only increment on new activations, not re-logins)
        if (!hwidMatches) {
            await supabase
                .from('keys')
                .update({ 
                    current_uses: keyData.current_uses + 1,
                    last_used: new Date().toISOString()
                })
                .eq('id', keyData.id);
        } else {
            // Just update last_used for returning users
            await supabase
                .from('keys')
                .update({ last_used: new Date().toISOString() })
                .eq('id', keyData.id);
        }
        
        // Log usage
        await supabase
            .from('usage_logs')
            .insert({
                key_id: keyData.id,
                ip_address: ip,
                hwid: hwid || null,
                game_id: game_id || null,
                executor: executor || null
            });
        
        // Calculate time remaining if expiration set
        let timeRemaining = null;
        if (keyData.expires_at) {
            const expiresAt = new Date(keyData.expires_at);
            const now = new Date();
            const diffMs = expiresAt - now;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            timeRemaining = `${diffDays}d ${diffHours}h`;
        }
        
        res.json({
            valid: true,
            message: 'Key validated successfully',
            data: {
                tier: keyData.tier || 'basic',
                expires_at: keyData.expires_at,
                time_remaining: timeRemaining,
                uses_remaining: keyData.max_uses > 0 ? keyData.max_uses - keyData.current_uses - 1 : 'unlimited',
                skip_validation: keyData.skip_validation,
                validated: keyData.validated
            }
        });
        
    } catch (error) {
        console.error('Validation error:', error);
        res.json({ 
            valid: false, 
            error: 'Validation failed' 
        });
    }
});

// Check key status (lightweight, no logging)
router.get('/check/:key', async (req, res) => {
    try {
        const { key } = req.params;
        
        const { data: keyData, error } = await supabase
            .from('keys')
            .select('status, tier, expires_at')
            .eq('key_value', key.toUpperCase().trim())
            .single();
        
        if (error || !keyData) {
            return res.json({ valid: false });
        }
        
        const isExpired = keyData.expires_at && new Date(keyData.expires_at) < new Date();
        
        res.json({
            valid: keyData.status === 'active' && !isExpired,
            status: keyData.status,
            tier: keyData.tier || 'basic',
            expires_at: keyData.expires_at
        });
        
    } catch (error) {
        res.json({ valid: false });
    }
});

module.exports = router;

