const express = require('express');
const bcrypt = require('bcryptjs');
const supabase = require('../db/supabase');
const { verifyToken, requireAdmin, requireSuperAdmin, requireModifyAccess } = require('../middleware/auth');

const router = express.Router();

// Get dashboard statistics
router.get('/stats', verifyToken, requireAdmin, async (req, res) => {
    try {
        // Total keys
        const { count: totalKeys } = await supabase
            .from('keys')
            .select('*', { count: 'exact', head: true });
        
        // Active keys
        const { count: activeKeys } = await supabase
            .from('keys')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active');
        
        // Total users
        const { count: totalUsers } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });
        
        // Today's validations
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { count: todayValidations } = await supabase
            .from('usage_logs')
            .select('*', { count: 'exact', head: true })
            .gte('used_at', today.toISOString());
        
        // Unique IPs today
        const { data: uniqueIPs } = await supabase
            .from('usage_logs')
            .select('ip_address')
            .gte('used_at', today.toISOString());
        
        const uniqueIPCount = new Set(uniqueIPs?.map(l => l.ip_address)).size;
        
        // Recent activity
        const { data: recentLogs } = await supabase
            .from('usage_logs')
            .select('*, keys(key_value)')
            .order('used_at', { ascending: false })
            .limit(10);
        
        // Keys by status
        const { data: statusCounts } = await supabase
            .from('keys')
            .select('status');
        
        const statusBreakdown = statusCounts?.reduce((acc, k) => {
            acc[k.status] = (acc[k.status] || 0) + 1;
            return acc;
        }, {}) || {};
        
        // Keys by tier
        const { data: tierCounts } = await supabase
            .from('keys')
            .select('tier');
        
        const tierBreakdown = tierCounts?.reduce((acc, k) => {
            const tier = k.tier || 'basic';
            acc[tier] = (acc[tier] || 0) + 1;
            return acc;
        }, {}) || {};
        
        res.json({
            stats: {
                totalKeys: totalKeys || 0,
                activeKeys: activeKeys || 0,
                totalUsers: totalUsers || 0,
                todayValidations: todayValidations || 0,
                uniqueUsersToday: uniqueIPCount
            },
            statusBreakdown,
            tierBreakdown,
            recentActivity: recentLogs || []
        });
        
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Get usage logs
router.get('/logs', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 50, key_id } = req.query;
        const offset = (page - 1) * limit;
        
        let query = supabase
            .from('usage_logs')
            .select('*, keys(key_value)', { count: 'exact' })
            .order('used_at', { ascending: false })
            .range(offset, offset + limit - 1);
        
        if (key_id) {
            query = query.eq('key_id', key_id);
        }
        
        const { data: logs, error, count } = await query;
        
        if (error) throw error;
        
        res.json({
            logs,
            total: count,
            page: parseInt(page),
            totalPages: Math.ceil(count / limit)
        });
        
    } catch (error) {
        console.error('Logs error:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// Get all users (admin can view, but see limited info)
router.get('/users', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('id, email, role, key_id, created_at')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Get key info for users with keys
        const usersWithKeys = await Promise.all(users.map(async (user) => {
            if (user.key_id) {
                const { data: keyData } = await supabase
                    .from('keys')
                    .select('key_value, tier, expires_at, status')
                    .eq('id', user.key_id)
                    .single();
                return { ...user, key: keyData };
            }
            return user;
        }));
        
        res.json({ users: usersWithKeys });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Update user role (super_admin only)
router.put('/users/:id/role', verifyToken, requireSuperAdmin, async (req, res) => {
    try {
        const { role } = req.body;
        
        if (!['user', 'admin', 'super_admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        
        // Prevent demoting yourself
        if (req.params.id === req.user.id && role !== 'super_admin') {
            return res.status(400).json({ error: 'Cannot demote yourself' });
        }
        
        const { data: updatedUser, error } = await supabase
            .from('users')
            .update({ role })
            .eq('id', req.params.id)
            .select('id, email, role')
            .single();
        
        if (error) throw error;
        
        res.json({
            message: 'User role updated',
            user: updatedUser
        });
    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ error: 'Failed to update role' });
    }
});

// Delete user (super_admin only)
router.delete('/users/:id', verifyToken, requireSuperAdmin, async (req, res) => {
    try {
        // Prevent deleting yourself
        if (req.params.id === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }
        
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', req.params.id);
        
        if (error) throw error;
        
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Create admin/mod user (super_admin only)
router.post('/users', verifyToken, requireSuperAdmin, async (req, res) => {
    try {
        const { email, password, role = 'admin' } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        
        if (!['admin', 'super_admin'].includes(role)) {
            return res.status(400).json({ error: 'Can only create admin or super_admin users' });
        }
        
        // Check if user exists
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();
        
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        
        const passwordHash = await bcrypt.hash(password, 10);
        
        const { data: newUser, error } = await supabase
            .from('users')
            .insert({
                email,
                password_hash: passwordHash,
                role
            })
            .select('id, email, role, created_at')
            .single();
        
        if (error) throw error;
        
        res.status(201).json({
            message: 'User created successfully',
            user: newUser
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Get analytics data
router.get('/analytics', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { days = 7 } = req.query;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        // Daily usage for the past X days
        const { data: logs } = await supabase
            .from('usage_logs')
            .select('used_at, game_id')
            .gte('used_at', startDate.toISOString());
        
        // Group by day
        const dailyUsage = {};
        const gameUsage = {};
        
        logs?.forEach(log => {
            const day = new Date(log.used_at).toISOString().split('T')[0];
            dailyUsage[day] = (dailyUsage[day] || 0) + 1;
            
            if (log.game_id) {
                gameUsage[log.game_id] = (gameUsage[log.game_id] || 0) + 1;
            }
        });
        
        // Fill in missing days
        const dailyData = [];
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            dailyData.push({
                date: dateStr,
                count: dailyUsage[dateStr] || 0
            });
        }
        
        // Top games
        const topGames = Object.entries(gameUsage)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([game_id, count]) => ({ game_id, count }));
        
        res.json({
            dailyUsage: dailyData,
            topGames
        });
        
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

module.exports = router;

