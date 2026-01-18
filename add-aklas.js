require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function createUser() {
    // Delete if exists
    await supabase.from('users').delete().eq('email', 'aklas@ransxm.com');
    
    const password = 'Ak3$xLm9#Qw7!pRz';
    const hash = await bcrypt.hash(password, 10);
    
    const { data, error } = await supabase.from('users').insert({
        email: 'aklas@ransxm.com',
        password_hash: hash,
        role: 'admin',
        created_at: new Date().toISOString()
    }).select();
    
    if (error) {
        console.log('Error:', error.message);
    } else {
        console.log('SUCCESS!');
        console.log('Email: aklas@ransxm.com');
        console.log('Password: Ak3$xLm9#Qw7!pRz');
    }
}

createUser();

