const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const supabase = require('./db/supabase');
const authRoutes = require('./routes/auth');
const keysRoutes = require('./routes/keys');
const validateRoutes = require('./routes/validate');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/keys', keysRoutes);
app.use('/api/validate', validateRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'RANSXM API is running',
        version: '2.0.0-roles',
        deployed: new Date().toISOString()
    });
});

// Root
app.get('/', (req, res) => {
    res.json({ 
        name: 'RANSXM Key Management API',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            validate: '/api/validate',
            auth: '/api/auth/*',
            keys: '/api/keys/*',
            admin: '/api/admin/*'
        }
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Initialize database and create admin user
async function initializeDatabase() {
    try {
        console.log('Checking database...');
        
        // Check if admin user exists
        const { data: adminUser } = await supabase
            .from('users')
            .select('id')
            .eq('role', 'admin')
            .single();
        
        if (!adminUser && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
            console.log('Creating admin user...');
            
            const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
            
            const { error } = await supabase
                .from('users')
                .insert({
                    email: process.env.ADMIN_EMAIL,
                    password_hash: passwordHash,
                    role: 'admin'
                });
            
            if (error) {
                console.error('Failed to create admin:', error.message);
            } else {
                console.log('Admin user created successfully!');
            }
        }
        
    } catch (error) {
        console.error('Database init error:', error.message);
    }
}

// Start server
app.listen(PORT, async () => {
    console.log('================================');
    console.log('  RANSXM Key Management API');
    console.log('================================');
    console.log(`Server running on port ${PORT}`);
    console.log(`API URL: http://localhost:${PORT}`);
    console.log('');
    
    await initializeDatabase();
    
    console.log('');
    console.log('Ready to accept connections!');
});

module.exports = app;

