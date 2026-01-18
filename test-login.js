// Test login directly against database
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testLogin() {
    const testEmail = 'nocta@ransxm.com';
    const testPassword = 'Nc9#pYh5$Bw3!kZm';
    
    console.log('Testing login for:', testEmail);
    console.log('Password:', testPassword);
    console.log('');
    
    // Get user from database
    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', testEmail)
        .single();
    
    if (error) {
        console.log('Database error:', error.message);
        return;
    }
    
    if (!user) {
        console.log('User not found!');
        return;
    }
    
    console.log('User found:');
    console.log('  ID:', user.id);
    console.log('  Email:', user.email);
    console.log('  Role:', user.role);
    console.log('  Hash length:', user.password_hash?.length);
    console.log('  Hash starts with:', user.password_hash?.substring(0, 10));
    console.log('');
    
    // Test password comparison
    console.log('Testing bcrypt.compare...');
    const isValid = await bcrypt.compare(testPassword, user.password_hash);
    console.log('Password valid:', isValid);
    
    if (!isValid) {
        console.log('\n--- DEBUG ---');
        // Create a new hash and compare
        const newHash = await bcrypt.hash(testPassword, 10);
        console.log('New hash created:', newHash.substring(0, 20) + '...');
        console.log('Stored hash:', user.password_hash.substring(0, 20) + '...');
    }
}

testLogin();

