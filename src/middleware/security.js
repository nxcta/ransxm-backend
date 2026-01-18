/**
 * RANSXM Security Middleware
 * Comprehensive security measures for the API
 */

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const validator = require('validator');
const xss = require('xss');

// ============================================
// RATE LIMITING
// ============================================

// General API rate limit: 100 requests per minute
const generalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.headers['x-forwarded-for'] || req.ip || 'unknown';
    }
});

// Strict login rate limit: 5 attempts per 15 minutes
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful logins
    keyGenerator: (req) => {
        return req.headers['x-forwarded-for'] || req.ip || 'unknown';
    }
});

// Registration rate limit: 3 per hour
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: { error: 'Too many registration attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.headers['x-forwarded-for'] || req.ip || 'unknown';
    }
});

// Key validation rate limit: 30 per minute (for Lua scripts)
const validateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: { valid: false, error: 'Rate limit exceeded. Please wait.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Rate limit by HWID if available, otherwise IP
        return req.body?.hwid || req.headers['x-forwarded-for'] || req.ip || 'unknown';
    }
});

// Key creation rate limit: 50 per hour (admin only)
const keyCreationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50,
    message: { error: 'Key creation limit reached. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// ============================================
// SECURITY HEADERS (Helmet)
// ============================================

const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false, // Allow API to be called
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
});

// ============================================
// INPUT VALIDATION & SANITIZATION
// ============================================

const sanitizeInput = (input) => {
    if (typeof input === 'string') {
        return xss(input.trim());
    }
    return input;
};

const validateEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    return validator.isEmail(email);
};

const validatePassword = (password) => {
    if (!password || typeof password !== 'string') return false;
    // Minimum 8 characters
    return password.length >= 8;
};

const validateKeyFormat = (key) => {
    if (!key || typeof key !== 'string') return false;
    // RNSXM-XXXX-XXXX-XXXX-XXXX format
    const keyRegex = /^RNSXM-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    return keyRegex.test(key.toUpperCase().trim());
};

// Middleware to sanitize all request body
const sanitizeBody = (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                req.body[key] = sanitizeInput(req.body[key]);
            }
        });
    }
    next();
};

// ============================================
// API KEY AUTHENTICATION (for Lua scripts)
// ============================================

const API_KEY = process.env.RANSXM_API_KEY || null;

const requireApiKey = (req, res, next) => {
    // Skip if no API key is configured
    if (!API_KEY) {
        return next();
    }
    
    const providedKey = req.headers['x-api-key'] || req.headers['x-ransxm-key'];
    
    if (!providedKey || providedKey !== API_KEY) {
        return res.status(401).json({ 
            valid: false, 
            error: 'Invalid or missing API key' 
        });
    }
    
    next();
};

// ============================================
// SECURITY LOGGING
// ============================================

const securityLog = (event, details, req) => {
    const logEntry = {
        timestamp: new Date().toISOString(),
        event,
        ip: req.headers['x-forwarded-for'] || req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        path: req.path,
        method: req.method,
        ...details
    };
    
    // Log to console (in production, send to logging service)
    console.log('[SECURITY]', JSON.stringify(logEntry));
    
    return logEntry;
};

// Log all requests middleware
const requestLogger = (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        const log = {
            timestamp: new Date().toISOString(),
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.headers['x-forwarded-for'] || req.ip || 'unknown'
        };
        
        // Log suspicious activity
        if (res.statusCode === 401 || res.statusCode === 403) {
            console.log('[SECURITY WARNING]', JSON.stringify(log));
        }
    });
    
    next();
};

// ============================================
// ACCOUNT LOCKOUT TRACKING
// ============================================

// In-memory store for failed login attempts (use Redis in production)
const failedAttempts = new Map();

const LOCKOUT_THRESHOLD = 5; // Lock after 5 failed attempts
const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes

const trackFailedLogin = (identifier) => {
    const attempts = failedAttempts.get(identifier) || { count: 0, lastAttempt: Date.now() };
    attempts.count++;
    attempts.lastAttempt = Date.now();
    failedAttempts.set(identifier, attempts);
    
    return attempts.count >= LOCKOUT_THRESHOLD;
};

const isAccountLocked = (identifier) => {
    const attempts = failedAttempts.get(identifier);
    if (!attempts) return false;
    
    // Check if lockout period has passed
    if (Date.now() - attempts.lastAttempt > LOCKOUT_DURATION) {
        failedAttempts.delete(identifier);
        return false;
    }
    
    return attempts.count >= LOCKOUT_THRESHOLD;
};

const clearFailedAttempts = (identifier) => {
    failedAttempts.delete(identifier);
};

const checkAccountLockout = (req, res, next) => {
    const email = req.body?.email;
    const ip = req.headers['x-forwarded-for'] || req.ip || 'unknown';
    const identifier = `${email || 'unknown'}-${ip}`;
    
    if (isAccountLocked(identifier)) {
        securityLog('ACCOUNT_LOCKED', { email, reason: 'Too many failed attempts' }, req);
        return res.status(429).json({ 
            error: 'Account temporarily locked due to too many failed attempts. Try again in 30 minutes.' 
        });
    }
    
    // Attach lockout functions to request for use in auth routes
    req.trackFailedLogin = () => trackFailedLogin(identifier);
    req.clearFailedAttempts = () => clearFailedAttempts(identifier);
    
    next();
};

// ============================================
// REQUEST SIZE LIMIT
// ============================================

const bodySizeLimit = (limit = '10kb') => {
    return (req, res, next) => {
        const contentLength = req.headers['content-length'];
        const maxBytes = parseInt(limit) * 1024; // Convert kb to bytes
        
        if (contentLength && parseInt(contentLength) > maxBytes) {
            return res.status(413).json({ error: 'Request too large' });
        }
        
        next();
    };
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
    // Rate limiters
    generalLimiter,
    loginLimiter,
    registerLimiter,
    validateLimiter,
    keyCreationLimiter,
    
    // Security headers
    securityHeaders,
    
    // Input validation
    sanitizeBody,
    sanitizeInput,
    validateEmail,
    validatePassword,
    validateKeyFormat,
    
    // API key auth
    requireApiKey,
    
    // Logging
    securityLog,
    requestLogger,
    
    // Account lockout
    checkAccountLockout,
    trackFailedLogin,
    clearFailedAttempts,
    isAccountLocked,
    
    // Request limits
    bodySizeLimit
};


