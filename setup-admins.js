// Setup Admin Accounts Script
// Run this once to create admin accounts

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// New admin accounts with strong passwords
const admins = [
    { email: 'wayne@ransxm.com', password: 'Wy7$nR3x#Km9!pQz', username: 'wayne' },
    { email: 'risk@ransxm.com', password: 'Rk4@tLm8#Xv2!sWq', username: 'risk' },
    { email: 'nocta@ransxm.com', password: 'Nc9#pYh5$Bw3!kZm', username: 'nocta' },
    { email: 'sosa@ransxm.com', password: 'Ss6!qRn7#Jc4$mXv', username: 'sosa' }
];

async function setupAdmins() {
    console.log('Setting up admin accounts...\n');
    
    // First, delete the old admin account
    console.log('Removing old admin account...');
    const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('email', 'admin@ransxm.com');
    
    if (deleteError) {
        console.log('Note: Could not delete old admin (may not exist):', deleteError.message);
    } else {
        console.log('Old admin account removed.\n');
    }
    
    // Create new admin accounts
    console.log('Creating new admin accounts...\n');
    console.log('='.repeat(60));
    console.log('SAVE THESE CREDENTIALS SECURELY!');
    console.log('='.repeat(60));
    
    for (const admin of admins) {
        const hashedPassword = await bcrypt.hash(admin.password, 10);
        
        const { data, error } = await supabase
            .from('users')
            .insert({
                email: admin.email,
                password_hash: hashedPassword,
                role: 'admin',
                created_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) {
            if (error.code === '23505') {
                console.log(`[SKIP] ${admin.username} - Account already exists`);
            } else {
                console.log(`[ERROR] ${admin.username}: ${error.message}`);
            }
        } else {
            console.log(`\n[CREATED] ${admin.username.toUpperCase()}`);
            console.log(`   Email:    ${admin.email}`);
            console.log(`   Password: ${admin.password}`);
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('Setup complete! Share credentials securely with your team.');
    console.log('='.repeat(60));
}

setupAdmins().catch(console.error);

