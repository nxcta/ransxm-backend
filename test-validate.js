// Test key validation endpoint
const https = require('https');

function post(path, data) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);
        
        const options = {
            hostname: 'ransxm-api.onrender.com',
            port: 443,
            path: '/api' + path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                console.log('Status:', res.statusCode);
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    resolve(body);
                }
            });
        });
        
        req.on('error', (e) => reject(e));
        req.write(postData);
        req.end();
    });
}

async function test() {
    // Test with a sample key - replace with actual key
    const testKey = process.argv[2] || 'RNSXM-TEST-TEST-TEST-TEST';
    
    console.log('Testing validation for key:', testKey);
    console.log('');
    
    const result = await post('/validate', {
        key: testKey,
        hwid: 'test-hwid-12345',
        game_id: '123456789',
        executor: 'TestExecutor'
    });
    
    console.log('Response:');
    console.log(JSON.stringify(result, null, 2));
}

test();

