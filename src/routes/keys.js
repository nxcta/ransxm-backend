const express = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../db/supabase');
const { verifyToken, requireAdmin, requireModifyAccess } = require('../middleware/auth');
const { keyCreationLimiter, securityLog } = require('../middleware/security');

const router = express.Router();

// Generate a random key
const generateKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = 'RNSXM-';
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            key += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        if (i < 3) key += '-';
    }
    return key;
};

// Get all keys (admin only)
router.get('/', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { search, status, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;
        
        let query = supabase
            .from('keys')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        
        if (search) {
            query = query.ilike('key_value', `%${search}%`);
        }
        
        if (status) {
            query = query.eq('status', status);
        }
        
        const { data: keys, error, count } = await query;
        
        if (error) {
            console.error('Keys query error:', error);
            throw error;
        }
        
        res.json({
            keys: keys || [],
            total: count || 0,
            page: parseInt(page),
            totalPages: Math.ceil((count || 0) / limit)
        });
    } catch (error) {
        console.error('Get keys error:', error);
        res.status(500).json({ error: 'Failed to fetch keys' });
    }
});

// Get single key
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const { data: key, error } = await supabase
            .from('keys')
            .select('*, users(email)')
            .eq('id', req.params.id)
            .single();
        
        if (error) throw error;
        
        // Non-admin can only view their own keys
        if (req.user.role !== 'admin' && key.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        res.json({ key });
    } catch (error) {
        console.error('Get key error:', error);
        res.status(500).json({ error: 'Failed to fetch key' });
    }
});

// Create single key (super_admin only - admins can only view)
router.post('/', verifyToken, requireModifyAccess, async (req, res) => {
    try {
        const { 
            owner_id = null,
            expires_at = null,
            max_uses = 1,
            tier = 'basic',
            skip_validation = false,
            note = ''
        } = req.body;
        
        // Validate tier
        const validTiers = ['basic', 'premium', 'ransxm'];
        if (!validTiers.includes(tier)) {
            return res.status(400).json({ error: 'Invalid tier. Must be: basic, premium, or ransxm' });
        }
        
        const keyValue = generateKey();
        
        // RANSXM tier keys always skip validation
        const shouldSkipValidation = tier === 'ransxm' ? true : skip_validation;
        
        const { data: newKey, error } = await supabase
            .from('keys')
            .insert({
                key_value: keyValue,
                owner_id,
                status: 'active',
                tier,
                skip_validation: shouldSkipValidation,
                validated: shouldSkipValidation, // Pre-validated if skipping
                validated_at: shouldSkipValidation ? new Date().toISOString() : null,
                expires_at,
                max_uses,
                current_uses: 0,
                hwid: null,
                note
            })
            .select()
            .single();
        
        if (error) throw error;
        
        res.status(201).json({
            message: 'Key created successfully',
            key: newKey
        });
    } catch (error) {
        console.error('Create key error:', error);
        res.status(500).json({ error: 'Failed to create key' });
    }
});

// Bulk create keys (super_admin only)
router.post('/bulk', verifyToken, requireModifyAccess, async (req, res) => {
    try {
        const { 
            count = 10,
            expires_at = null,
            max_uses = 1,
            tier = 'basic',
            skip_validation = false,
            prefix = ''
        } = req.body;
        
        if (count > 100) {
            return res.status(400).json({ error: 'Maximum 100 keys per batch' });
        }
        
        // Validate tier
        const validTiers = ['basic', 'premium', 'ransxm'];
        if (!validTiers.includes(tier)) {
            return res.status(400).json({ error: 'Invalid tier. Must be: basic, premium, or ransxm' });
        }
        
        // RANSXM tier keys always skip validation
        const shouldSkipValidation = tier === 'ransxm' ? true : skip_validation;
        
        const keys = [];
        for (let i = 0; i < count; i++) {
            keys.push({
                key_value: generateKey(),
                owner_id: null,
                status: 'active',
                tier,
                skip_validation: shouldSkipValidation,
                validated: shouldSkipValidation,
                validated_at: shouldSkipValidation ? new Date().toISOString() : null,
                expires_at,
                max_uses,
                current_uses: 0,
                hwid: null,
                note: prefix ? `${prefix}-${i + 1}` : null
            });
        }
        
        const { data: newKeys, error } = await supabase
            .from('keys')
            .insert(keys)
            .select();
        
        if (error) throw error;
        
        res.status(201).json({
            message: `${count} keys created successfully`,
            keys: newKeys
        });
    } catch (error) {
        console.error('Bulk create error:', error);
        res.status(500).json({ error: 'Failed to create keys' });
    }
});

// Update key (super_admin only)
router.put('/:id', verifyToken, requireModifyAccess, async (req, res) => {
    try {
        const { status, expires_at, max_uses, tier, skip_validation, note, owner_id } = req.body;
        
        // Validate tier if provided
        if (tier !== undefined) {
            const validTiers = ['basic', 'premium', 'ransxm'];
            if (!validTiers.includes(tier)) {
                return res.status(400).json({ error: 'Invalid tier. Must be: basic, premium, or ransxm' });
            }
        }
        
        const updateData = {};
        if (status !== undefined) updateData.status = status;
        if (expires_at !== undefined) updateData.expires_at = expires_at;
        if (max_uses !== undefined) updateData.max_uses = max_uses;
        if (tier !== undefined) {
            updateData.tier = tier;
            // RANSXM tier always skips validation
            if (tier === 'ransxm') {
                updateData.skip_validation = true;
                updateData.validated = true;
                updateData.validated_at = new Date().toISOString();
            }
        }
        if (skip_validation !== undefined) updateData.skip_validation = skip_validation;
        if (note !== undefined) updateData.note = note;
        if (owner_id !== undefined) updateData.owner_id = owner_id;
        
        const { data: updatedKey, error } = await supabase
            .from('keys')
            .update(updateData)
            .eq('id', req.params.id)
            .select()
            .single();
        
        if (error) throw error;
        
        res.json({
            message: 'Key updated successfully',
            key: updatedKey
        });
    } catch (error) {
        console.error('Update key error:', error);
        res.status(500).json({ error: 'Failed to update key' });
    }
});

// Reset HWID (super_admin only)
router.post('/:id/reset-hwid', verifyToken, requireModifyAccess, async (req, res) => {
    try {
        const { data: updatedKey, error } = await supabase
            .from('keys')
            .update({ hwid: null })
            .eq('id', req.params.id)
            .select()
            .single();
        
        if (error) throw error;
        
        res.json({
            message: 'HWID reset successfully',
            key: updatedKey
        });
    } catch (error) {
        console.error('Reset HWID error:', error);
        res.status(500).json({ error: 'Failed to reset HWID' });
    }
});

// Reset Uses (super_admin only)
router.post('/:id/reset-uses', verifyToken, requireModifyAccess, async (req, res) => {
    try {
        const { data: updatedKey, error } = await supabase
            .from('keys')
            .update({ current_uses: 0 })
            .eq('id', req.params.id)
            .select()
            .single();
        
        if (error) throw error;
        
        res.json({
            message: 'Uses reset successfully',
            key: updatedKey
        });
    } catch (error) {
        console.error('Reset uses error:', error);
        res.status(500).json({ error: 'Failed to reset uses' });
    }
});

// Delete key (super_admin only)
router.delete('/:id', verifyToken, requireModifyAccess, async (req, res) => {
    try {
        const { error } = await supabase
            .from('keys')
            .delete()
            .eq('id', req.params.id);
        
        if (error) throw error;
        
        res.json({ message: 'Key deleted successfully' });
    } catch (error) {
        console.error('Delete key error:', error);
        res.status(500).json({ error: 'Failed to delete key' });
    }
});

// Batch delete keys (super_admin only)
router.post('/batch-delete', verifyToken, requireModifyAccess, async (req, res) => {
    try {
        const { ids } = req.body;
        
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'No key IDs provided' });
        }
        
        if (ids.length > 100) {
            return res.status(400).json({ error: 'Maximum 100 keys per batch delete' });
        }
        
        const { error } = await supabase
            .from('keys')
            .delete()
            .in('id', ids);
        
        if (error) throw error;
        
        res.json({ message: `${ids.length} keys deleted successfully` });
    } catch (error) {
        console.error('Batch delete error:', error);
        res.status(500).json({ error: 'Failed to delete keys' });
    }
});

// Batch update status (super_admin only)
router.post('/batch-status', verifyToken, requireModifyAccess, async (req, res) => {
    try {
        const { ids, status } = req.body;
        
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'No key IDs provided' });
        }
        
        const validStatuses = ['active', 'disabled', 'banned'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        
        const { error } = await supabase
            .from('keys')
            .update({ status })
            .in('id', ids);
        
        if (error) throw error;
        
        res.json({ message: `${ids.length} keys updated to ${status}` });
    } catch (error) {
        console.error('Batch status error:', error);
        res.status(500).json({ error: 'Failed to update keys' });
    }
});

// Export keys (admin only)
router.get('/export', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { format = 'csv', status, tier } = req.query;
        
        let query = supabase
            .from('keys')
            .select('key_value, status, tier, hwid, current_uses, max_uses, expires_at, created_at, note')
            .order('created_at', { ascending: false });
        
        if (status) query = query.eq('status', status);
        if (tier) query = query.eq('tier', tier);
        
        const { data: keys, error } = await query;
        
        if (error) throw error;
        
        if (format === 'txt') {
            // Simple text format - just keys
            const txt = keys.map(k => k.key_value).join('\n');
            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Content-Disposition', 'attachment; filename=ransxm-keys.txt');
            return res.send(txt);
        }
        
        // CSV format
        const headers = ['Key', 'Status', 'Tier', 'HWID', 'Uses', 'Max Uses', 'Expires', 'Created', 'Note'];
        const rows = keys.map(k => [
            k.key_value,
            k.status,
            k.tier || 'basic',
            k.hwid || '',
            k.current_uses,
            k.max_uses === 0 ? 'Unlimited' : k.max_uses,
            k.expires_at ? new Date(k.expires_at).toISOString() : 'Never',
            new Date(k.created_at).toISOString(),
            (k.note || '').replace(/,/g, ';')
        ]);
        
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=ransxm-keys.csv');
        res.send(csv);
        
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export keys' });
    }
});

// Get user's keys
router.get('/user/me', verifyToken, async (req, res) => {
    try {
        const { data: keys, error } = await supabase
            .from('keys')
            .select('*')
            .eq('owner_id', req.user.id)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        res.json({ keys });
    } catch (error) {
        console.error('Get user keys error:', error);
        res.status(500).json({ error: 'Failed to fetch keys' });
    }
});

module.exports = router;

