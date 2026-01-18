// Fix the expired key
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixKey() {
    const keyValue = 'RNSXM-SCWZ-ETWB-2BMJ-4WJX';
    
    console.log('Fixing key:', keyValue);
    
    // Update the key status to active and remove expiration
    const { data, error } = await supabase
        .from('keys')
        .update({ 
            status: 'active',
            expires_at: null  // Remove expiration
        })
        .eq('key_value', keyValue)
        .select()
        .single();
    
    if (error) {
        console.log('Error:', error.message);
        return;
    }
    
    console.log('\nKey fixed!');
    console.log('Status:', data.status);
    console.log('Tier:', data.tier);
    console.log('Skip Validation:', data.skip_validation);
    console.log('Expires:', data.expires_at || 'Never');
}

fixKey();

