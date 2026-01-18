const express = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../db/supabase');
const { verifyToken, requireAdmin } = require('../middleware/auth');

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
            .select('*, users(email)', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        
        if (search) {
            query = query.ilike('key_value', `%${search}%`);
        }
        
        if (status) {
            query = query.eq('status', status);
        }
        
        const { data: keys, error, count } = await query;
        
        if (error) throw error;
        
        res.json({
            keys,
            total: count,
            page: parseInt(page),
            totalPages: Math.ceil(count / limit)
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

// Create single key (admin only)
router.post('/', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { 
            owner_id = null,
            expires_at = null,
            max_uses = 1,
            note = ''
        } = req.body;
        
        const keyValue = generateKey();
        
        const { data: newKey, error } = await supabase
            .from('keys')
            .insert({
                key_value: keyValue,
                owner_id,
                status: 'active',
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

// Bulk create keys (admin only)
router.post('/bulk', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { 
            count = 10,
            expires_at = null,
            max_uses = 1,
            prefix = ''
        } = req.body;
        
        if (count > 100) {
            return res.status(400).json({ error: 'Maximum 100 keys per batch' });
        }
        
        const keys = [];
        for (let i = 0; i < count; i++) {
            keys.push({
                key_value: generateKey(),
                owner_id: null,
                status: 'active',
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

// Update key (admin only)
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { status, expires_at, max_uses, note, owner_id } = req.body;
        
        const updateData = {};
        if (status !== undefined) updateData.status = status;
        if (expires_at !== undefined) updateData.expires_at = expires_at;
        if (max_uses !== undefined) updateData.max_uses = max_uses;
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

// Reset HWID (admin only)
router.post('/:id/reset-hwid', verifyToken, requireAdmin, async (req, res) => {
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

// Delete key (admin only)
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
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

