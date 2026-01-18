const express = require('express');
const bcrypt = require('bcryptjs');
const supabase = require('../db/supabase');
const { generateToken, verifyToken } = require('../middleware/auth');

const router = express.Router();

// Register new user (requires key for regular users)
router.post('/register', async (req, res) => {
    try {
        const { email, password, key } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        
        if (!key) {
            return res.status(400).json({ error: 'Key required for registration' });
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
        
        // Validate the key
        const { data: keyData, error: keyError } = await supabase
            .from('keys')
            .select('*')
            .eq('key_value', key)
            .single();
        
        if (keyError || !keyData) {
            return res.status(400).json({ error: 'Invalid key' });
        }
        
        // Check if key is already claimed by another user
        if (keyData.owner_id) {
            return res.status(400).json({ error: 'Key has already been claimed' });
        }
        
        // Check if key is active
        if (keyData.status !== 'active') {
            return res.status(400).json({ error: 'Key is not active' });
        }
        
        // Check if key is expired
        if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
            return res.status(400).json({ error: 'Key has expired' });
        }
        
        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);
        
        // Create user with linked key
        const { data: newUser, error: userError } = await supabase
            .from('users')
            .insert({
                email,
                password_hash: passwordHash,
                role: 'user',
                key_id: keyData.id
            })
            .select()
            .single();
        
        if (userError) throw userError;
        
        // Update key: mark as validated and link to user
        await supabase
            .from('keys')
            .update({
                owner_id: newUser.id,
                validated: true,
                validated_at: new Date().toISOString()
            })
            .eq('id', keyData.id);
        
        const token = generateToken(newUser);
        
        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: newUser.id,
                email: newUser.email,
                role: newUser.role,
                key_id: keyData.id
            },
            key: {
                tier: keyData.tier,
                expires_at: keyData.expires_at
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        
        // Find user with their key info
        const { data: user, error } = await supabase
            .from('users')
            .select('*, keys(*)')
            .eq('email', email)
            .single();
        
        if (error || !user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Check password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = generateToken(user);
        
        // Get key info if user has a linked key
        let keyInfo = null;
        if (user.key_id) {
            const { data: keyData } = await supabase
                .from('keys')
                .select('tier, expires_at, status, current_uses, max_uses')
                .eq('id', user.key_id)
                .single();
            keyInfo = keyData;
        }
        
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                key_id: user.key_id
            },
            key: keyInfo
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get current user with key info
router.get('/me', verifyToken, async (req, res) => {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, role, key_id, created_at')
            .eq('id', req.user.id)
            .single();
        
        if (error) throw error;
        
        // Get key info for regular users
        let keyInfo = null;
        if (user.key_id) {
            const { data: keyData } = await supabase
                .from('keys')
                .select('key_value, tier, expires_at, status, current_uses, max_uses, hwid, last_used, created_at')
                .eq('id', user.key_id)
                .single();
            keyInfo = keyData;
        }
        
        res.json({ 
            user,
            key: keyInfo
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// Get user's usage logs
router.get('/my-logs', verifyToken, async (req, res) => {
    try {
        const { data: user } = await supabase
            .from('users')
            .select('key_id')
            .eq('id', req.user.id)
            .single();
        
        if (!user?.key_id) {
            return res.json({ logs: [] });
        }
        
        const { data: logs, error } = await supabase
            .from('usage_logs')
            .select('*')
            .eq('key_id', user.key_id)
            .order('used_at', { ascending: false })
            .limit(50);
        
        if (error) throw error;
        
        res.json({ logs });
    } catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({ error: 'Failed to get logs' });
    }
});

module.exports = router;

