// Fix passwords - rehash with bcryptjs (same as auth.js uses)
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs'); // MUST use bcryptjs to match auth.js
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixPasswords() {
    console.log('='.repeat(60));
    console.log('FIXING ALL PASSWORDS (rehashing with bcryptjs)');
    console.log('='.repeat(60));
    
    // All accounts with their passwords
    const accounts = [
        { email: 'wayne@ransxm.com', password: 'Wy7$nR3x#Km9!pQz' },
        { email: 'risk@ransxm.com', password: 'Rk4@tLm8#Xv2!sWq' },
        { email: 'nocta@ransxm.com', password: 'Nc9#pYh5$Bw3!kZm' },
        { email: 'sosa@ransxm.com', password: 'Ss6!qRn7#Jc4$mXv' },
        { email: 'aklas@ransxm.com', password: 'Ak3$xLm9#Qw7!pRz' },
        { email: 'kru@ransxm.com', password: 'Kr8$mNx4#Qp7!zWv' },
    ];
    
    console.log('\nRehashing passwords...\n');
    
    for (const account of accounts) {
        const hash = await bcrypt.hash(account.password, 10);
        
        const { error } = await supabase
            .from('users')
            .update({ password_hash: hash })
            .eq('email', account.email);
        
        if (error) {
            console.log(`[ERROR] ${account.email}: ${error.message}`);
        } else {
            console.log(`[FIXED] ${account.email}`);
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('ALL PASSWORDS FIXED! You can now login.');
    console.log('='.repeat(60));
    console.log('\nCredentials:');
    console.log('-'.repeat(60));
    accounts.forEach(a => {
        console.log(`${a.email.padEnd(25)} | ${a.password}`);
    });
    console.log('-'.repeat(60));
}

fixPasswords();

