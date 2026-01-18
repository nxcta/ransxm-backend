// List all keys in database
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listKeys() {
    console.log('Listing all keys...\n');
    
    const { data: keys, error } = await supabase
        .from('keys')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
    
    if (error) {
        console.log('Error:', error.message);
        return;
    }
    
    if (!keys || keys.length === 0) {
        console.log('No keys found in database!');
        return;
    }
    
    console.log(`Found ${keys.length} keys:\n`);
    keys.forEach((k, i) => {
        console.log(`${i + 1}. ${k.key_value}`);
        console.log(`   Tier: ${k.tier || 'basic'}`);
        console.log(`   Status: ${k.status}`);
        console.log(`   Skip Validation: ${k.skip_validation || false}`);
        console.log(`   Validated: ${k.validated || false}`);
        console.log(`   Uses: ${k.current_uses}/${k.max_uses || 'unlimited'}`);
        console.log('');
    });
}

listKeys();

