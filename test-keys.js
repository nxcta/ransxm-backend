// Test keys endpoint
const https = require('https');

// First login to get token
function post(path, data, token = null) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);
        
        const headers = {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const options = {
            hostname: 'ransxm-api.onrender.com',
            port: 443,
            path: '/api' + path,
            method: 'POST',
            headers
        };
        
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                console.log(`POST ${path} - Status: ${res.statusCode}`);
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

function get(path, token) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'ransxm-api.onrender.com',
            port: 443,
            path: '/api' + path,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        };
        
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                console.log(`GET ${path} - Status: ${res.statusCode}`);
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    resolve(body);
                }
            });
        });
        
        req.on('error', (e) => reject(e));
        req.end();
    });
}

async function test() {
    console.log('=== Testing Keys Endpoint ===\n');
    
    // Login first
    console.log('1. Logging in...');
    const loginResult = await post('/auth/login', {
        email: 'nocta@ransxm.com',
        password: 'Nc9#pYh5$Bw3!kZm'
    });
    
    if (!loginResult.token) {
        console.log('Login failed:', loginResult);
        return;
    }
    
    console.log('   Token received!');
    console.log('   Role:', loginResult.user?.role);
    
    // Get keys
    console.log('\n2. Fetching keys...');
    const keysResult = await get('/keys', loginResult.token);
    
    console.log('\nKeys Result:');
    console.log(JSON.stringify(keysResult, null, 2));
}

test();

