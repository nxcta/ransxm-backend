// Check all accounts in database
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAccounts() {
    console.log('Checking all accounts...\n');
    
    const { data: users, error } = await supabase
        .from('users')
        .select('id, email, role, password_hash')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.log('Error:', error.message);
        return;
    }
    
    if (!users || users.length === 0) {
        console.log('NO ACCOUNTS FOUND IN DATABASE!');
        return;
    }
    
    console.log('Found', users.length, 'accounts:\n');
    users.forEach(u => {
        const hasPassword = u.password_hash && u.password_hash.length > 10;
        console.log(`Email: ${u.email}`);
        console.log(`Role: ${u.role}`);
        console.log(`Has Password Hash: ${hasPassword ? 'YES' : 'NO'}`);
        console.log('---');
    });
}

checkAccounts();

