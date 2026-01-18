const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixRansxmKeys() {
    console.log('============================================');
    console.log('  Fixing RANSXM Tier Keys');
    console.log('============================================\n');

    // Find all RANSXM tier keys
    const { data: keys, error: fetchError } = await supabase
        .from('keys')
        .select('*')
        .eq('tier', 'ransxm');

    if (fetchError) {
        console.error('Error fetching keys:', fetchError.message);
        return;
    }

    console.log(`Found ${keys.length} RANSXM tier keys\n`);

    let fixed = 0;
    let alreadyFixed = 0;

    for (const key of keys) {
        const needsFix = !key.skip_validation || !key.validated;

        if (needsFix) {
            console.log(`Fixing: ${key.key_value}`);
            console.log(`  Current: skip_validation=${key.skip_validation}, validated=${key.validated}`);

            const { error: updateError } = await supabase
                .from('keys')
                .update({
                    skip_validation: true,
                    validated: true,
                    validated_at: new Date().toISOString(),
                    status: 'active' // Ensure it's active
                })
                .eq('id', key.id);

            if (updateError) {
                console.error(`  ERROR: ${updateError.message}\n`);
            } else {
                console.log(`  ✅ Fixed!\n`);
                fixed++;
            }
        } else {
            console.log(`✓ ${key.key_value} - Already correct\n`);
            alreadyFixed++;
        }
    }

    console.log('============================================');
    console.log(`Fixed: ${fixed}`);
    console.log(`Already correct: ${alreadyFixed}`);
    console.log(`Total: ${keys.length}`);
    console.log('============================================\n');
}

fixRansxmKeys();

