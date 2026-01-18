/**
 * RANSXM Security Key Generator
 * Run this to generate strong secrets for your .env file
 */

const crypto = require('crypto');

console.log('============================================');
console.log('  RANSXM Security Key Generator');
console.log('============================================\n');

// Generate JWT Secret (64 bytes = 128 hex chars)
const jwtSecret = crypto.randomBytes(64).toString('hex');
console.log('JWT_SECRET (copy this to your .env):');
console.log(`JWT_SECRET=${jwtSecret}\n`);

// Generate API Key for Lua script (32 bytes = 64 hex chars)
const apiKey = 'RNSXM_' + crypto.randomBytes(32).toString('hex').toUpperCase();
console.log('RANSXM_API_KEY (optional, for Lua script auth):');
console.log(`RANSXM_API_KEY=${apiKey}\n`);

console.log('============================================');
console.log('IMPORTANT: Add these to your .env file');
console.log('and redeploy your backend on Render!');
console.log('============================================\n');

// Full .env example
console.log('Full .env example:\n');
console.log('-----------------------------------');
console.log('PORT=3000');
console.log('SUPABASE_URL=https://your-project.supabase.co');
console.log('SUPABASE_SERVICE_KEY=your-service-key');
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`RANSXM_API_KEY=${apiKey}`);
console.log('FRONTEND_URL=https://your-frontend.vercel.app');
console.log('-----------------------------------');

