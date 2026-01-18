// Script to upgrade all admins to super_admin (run AFTER SQL migration)
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function upgradeToSuper() {
    console.log('Upgrading all admins to super_admin...\n');
    
    // Get all admins except kru
    const { data: admins } = await supabase
        .from('users')
        .select('id, email, role')
        .eq('role', 'admin')
        .neq('email', 'kru@ransxm.com');
    
    if (!admins || admins.length === 0) {
        console.log('No admin accounts to upgrade.');
        return;
    }
    
    for (const admin of admins) {
        const { error } = await supabase
            .from('users')
            .update({ role: 'super_admin' })
            .eq('id', admin.id);
        
        if (error) {
            console.log(`[ERROR] ${admin.email}: ${error.message}`);
        } else {
            console.log(`[UPGRADED] ${admin.email} → SUPER_ADMIN`);
        }
    }
    
    // Also delete admin@ransxm.com if it exists
    const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('email', 'admin@ransxm.com');
    
    if (!deleteError) {
        console.log(`\n[DELETED] admin@ransxm.com`);
    }
    
    // Show final list
    console.log('\n' + '='.repeat(50));
    console.log('FINAL ACCOUNT LIST');
    console.log('='.repeat(50));
    
    const { data: allUsers } = await supabase
        .from('users')
        .select('email, role')
        .in('role', ['admin', 'super_admin'])
        .order('role', { ascending: false });
    
    if (allUsers) {
        allUsers.forEach(u => {
            const icon = u.role === 'super_admin' ? '★' : '○';
            const label = u.role === 'super_admin' ? 'SUPER ADMIN' : 'ADMIN (View Only)';
            console.log(`${icon} ${u.email.padEnd(25)} → ${label}`);
        });
    }
    console.log('='.repeat(50));
}

upgradeToSuper();

