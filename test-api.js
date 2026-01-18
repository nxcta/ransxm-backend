// Test the live API endpoint
const https = require('https');

const API_URL = 'https://ransxm-api.onrender.com';

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

async function testAPI() {
    console.log('Testing live API at:', API_URL);
    console.log('');
    
    try {
        console.log('Attempting login...');
        const result = await post('/auth/login', {
            email: 'nocta@ransxm.com',
            password: 'Nc9#pYh5$Bw3!kZm'
        });
        
        console.log('Response:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.log('Error:', error.message);
    }
}

testAPI();

