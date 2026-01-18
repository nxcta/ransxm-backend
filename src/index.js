const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const supabase = require('./db/supabase');
const authRoutes = require('./routes/auth');
const keysRoutes = require('./routes/keys');
const validateRoutes = require('./routes/validate');
const adminRoutes = require('./routes/admin');

// Security middleware
const {
    generalLimiter,
    securityHeaders,
    sanitizeBody,
    requestLogger,
    bodySizeLimit
} = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// SECURITY CONFIGURATION
// ============================================

// Trust proxy (needed for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Security headers (Helmet)
app.use(securityHeaders);

// CORS - Restrict to allowed origins
const allowedOrigins = [
    'https://ransxm-dashboard.vercel.app',
    'https://ransxm.vercel.app',
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
].filter(Boolean);

app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (Lua scripts, Postman, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log('[SECURITY] Blocked origin:', origin);
            callback(null, true); // Still allow but log it
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-RANSXM-Key']
}));

// Request size limit (prevent large payload attacks)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Sanitize all input
app.use(sanitizeBody);

// General rate limiting
app.use(generalLimiter);

// Security logging
app.use(requestLogger);

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
        version: '3.0.0-secured',
        security: 'enabled'
    });
});

// Root - minimal info (security through obscurity)
app.get('/', (req, res) => {
    res.json({ 
        name: 'RANSXM API',
        status: 'online'
    });
});

// Error handling - hide internal errors
app.use((err, req, res, next) => {
    console.error('[ERROR]', new Date().toISOString(), err.message);
    
    // Don't leak internal error details
    res.status(500).json({ error: 'Something went wrong' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
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

