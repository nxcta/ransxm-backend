const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function upgradeAklas() {
    console.log('Upgrading aklas to super_admin...\n');

    const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('id, email, role')
        .eq('email', 'aklas@ransxm.com')
        .single();

    if (fetchError || !user) {
        console.error('Error: aklas account not found');
        console.error(fetchError?.message);
        return;
    }

    console.log(`Found account: ${user.email}`);
    console.log(`Current role: ${user.role}`);

    const { error: updateError } = await supabase
        .from('users')
        .update({ role: 'super_admin' })
        .eq('id', user.id);

    if (updateError) {
        console.error('Error upgrading:', updateError.message);
        return;
    }

    console.log('\n✅ SUCCESS!');
    console.log('aklas@ransxm.com is now SUPER_ADMIN');
    
    // Verify
    const { data: updated } = await supabase
        .from('users')
        .select('email, role')
        .eq('email', 'aklas@ransxm.com')
        .single();
    
    console.log(`Verified: ${updated.email} → ${updated.role.toUpperCase()}`);
}

upgradeAklas();

