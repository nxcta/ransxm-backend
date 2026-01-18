const express = require('express');
const supabase = require('../db/supabase');
const { validateLimiter, securityLog, validateKeyFormat } = require('../middleware/security');

const router = express.Router();

// Validate key (called from Lua script)
// Rate limited - NO API key required (validation should be open)
router.post('/', validateLimiter, async (req, res) => {
    try {
        const { key, hwid, game_id, executor } = req.body;
        const ip = req.headers['x-forwarded-for'] || req.ip || 'unknown';
        
        if (!key) {
            securityLog('VALIDATE_NO_KEY', { hwid, game_id }, req);
            return res.json({ 
                valid: false, 
                error: 'No key provided' 
            });
        }
        
        // Basic key format validation
        const cleanKey = key.toUpperCase().trim();
        if (!validateKeyFormat(cleanKey)) {
            securityLog('VALIDATE_INVALID_FORMAT', { key: cleanKey.substring(0, 10), hwid }, req);
            return res.json({ 
                valid: false, 
                error: 'Invalid key format' 
            });
        }
        
        // Find the key
        const { data: keyData, error } = await supabase
            .from('keys')
            .select('*')
            .eq('key_value', cleanKey)
            .single();
        
        if (error || !keyData) {
            securityLog('VALIDATE_KEY_NOT_FOUND', { key: cleanKey.substring(0, 10), hwid }, req);
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
        
        // Log successful validation
        securityLog('VALIDATE_SUCCESS', { 
            key: keyData.key_value.substring(0, 10) + '...', 
            tier: keyData.tier, 
            hwid: hwid ? hwid.substring(0, 10) + '...' : 'none',
            game_id 
        }, req);
        
        res.json({
            valid: true,
            message: 'Key validated successfully',
            data: {
                tier: keyData.tier || 'basic',
                expires_at: keyData.expires_at,
                time_remaining: timeRemaining,
                uses_remaining: keyData.max_uses > 0 ? keyData.max_uses - keyData.current_uses - 1 : 'unlimited'
            }
        });
        
    } catch (error) {
        console.error('[ERROR] Validation:', error.message);
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

