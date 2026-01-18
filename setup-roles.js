// Script to upgrade admins to super_admin and add new admin (kru)
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupRoles() {
    console.log('='.repeat(60));
    console.log('RANSXM Role Setup');
    console.log('='.repeat(60));
    
    try {
        // Step 1: Upgrade all current admins to super_admin
        console.log('\n[1] Upgrading all admins to super_admin...');
        
        const { data: admins, error: fetchError } = await supabase
            .from('users')
            .select('id, email, role')
            .eq('role', 'admin');
        
        if (fetchError) throw fetchError;
        
        if (admins && admins.length > 0) {
            for (const admin of admins) {
                const { error } = await supabase
                    .from('users')
                    .update({ role: 'super_admin' })
                    .eq('id', admin.id);
                
                if (error) {
                    console.log(`   [ERROR] ${admin.email}: ${error.message}`);
                } else {
                    console.log(`   [UPGRADED] ${admin.email} → SUPER_ADMIN`);
                }
            }
        } else {
            console.log('   No admin accounts found to upgrade.');
        }
        
        // Step 2: Create kru as admin (view-only)
        console.log('\n[2] Creating KRU admin account...');
        
        const kruEmail = 'kru@ransxm.com';
        const kruPassword = 'Kr8$mNx4#Qp7!zWv'; // Strong password
        
        // Check if already exists
        const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('email', kruEmail)
            .single();
        
        if (existing) {
            // Update to admin role
            await supabase
                .from('users')
                .update({ role: 'admin' })
                .eq('email', kruEmail);
            console.log(`   [UPDATED] ${kruEmail} set to ADMIN role`);
        } else {
            // Create new account
            const passwordHash = await bcrypt.hash(kruPassword, 10);
            
            const { error: createError } = await supabase
                .from('users')
                .insert({
                    email: kruEmail,
                    password_hash: passwordHash,
                    role: 'admin' // View-only admin
                });
            
            if (createError) {
                console.log(`   [ERROR] ${kruEmail}: ${createError.message}`);
            } else {
                console.log(`   [CREATED] ${kruEmail} as ADMIN (view-only)`);
            }
        }
        
        // Step 3: Show final account list
        console.log('\n' + '='.repeat(60));
        console.log('FINAL ACCOUNT LIST');
        console.log('='.repeat(60));
        
        const { data: allUsers } = await supabase
            .from('users')
            .select('email, role')
            .in('role', ['admin', 'super_admin'])
            .order('role', { ascending: false });
        
        if (allUsers) {
            allUsers.forEach(u => {
                const roleLabel = u.role === 'super_admin' ? 'SUPER ADMIN (Full Access)' : 'ADMIN (View Only)';
                console.log(`   ${u.email.padEnd(25)} → ${roleLabel}`);
            });
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('KRU CREDENTIALS (SAVE THESE!)');
        console.log('='.repeat(60));
        console.log(`   Email:    ${kruEmail}`);
        console.log(`   Password: ${kruPassword}`);
        console.log(`   Role:     ADMIN (View Only)`);
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

setupRoles();

