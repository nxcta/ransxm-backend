// Script to upgrade existing admin accounts to super_admin
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function upgradeAdmins() {
    console.log('Upgrading admin accounts to super_admin...');
    
    try {
        // Get all admin users
        const { data: admins, error: fetchError } = await supabase
            .from('users')
            .select('id, email, role')
            .eq('role', 'admin');
        
        if (fetchError) throw fetchError;
        
        console.log(`Found ${admins.length} admin accounts to upgrade`);
        
        // Update each admin to super_admin
        for (const admin of admins) {
            const { error } = await supabase
                .from('users')
                .update({ role: 'super_admin' })
                .eq('id', admin.id);
            
            if (error) {
                console.error(`Failed to upgrade ${admin.email}:`, error.message);
            } else {
                console.log(`✓ Upgraded ${admin.email} to super_admin`);
            }
        }
        
        console.log('\nUpgrade complete!');
        console.log('All existing admin accounts now have super_admin privileges.');
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

upgradeAdmins();

