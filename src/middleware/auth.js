const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'ransxm-secret-key';

// Role hierarchy: super_admin > admin > user
const ROLE_LEVELS = {
    user: 1,
    admin: 2,
    super_admin: 3
};

// Verify JWT token
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

// Check if user is super_admin (full access)
const requireSuperAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'super_admin') {
        next();
    } else {
        return res.status(403).json({ error: 'Access denied - Super Admin required' });
    }
};

// Check if user is admin or super_admin (for viewing)
const requireAdmin = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'super_admin')) {
        next();
    } else {
        return res.status(403).json({ error: 'Access denied - Admin required' });
    }
};

// Check if user can modify (only super_admin can create/edit/delete)
const requireModifyAccess = (req, res, next) => {
    if (req.user && req.user.role === 'super_admin') {
        next();
    } else {
        return res.status(403).json({ error: 'Access denied - You can only view, not modify' });
    }
};

// Check if user is regular user
const requireUser = (req, res, next) => {
    if (req.user) {
        next();
    } else {
        return res.status(403).json({ error: 'Access denied' });
    }
};

// Helper to check role level
const hasRoleLevel = (user, requiredRole) => {
    const userLevel = ROLE_LEVELS[user?.role] || 0;
    const requiredLevel = ROLE_LEVELS[requiredRole] || 0;
    return userLevel >= requiredLevel;
};

// Generate JWT token
const generateToken = (user) => {
    return jwt.sign(
        { 
            id: user.id, 
            email: user.email, 
            role: user.role,
            key_id: user.key_id || null
        },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
};

module.exports = { 
    verifyToken, 
    requireAdmin, 
    requireSuperAdmin,
    requireModifyAccess,
    requireUser,
    hasRoleLevel,
    generateToken,
    ROLE_LEVELS
};

