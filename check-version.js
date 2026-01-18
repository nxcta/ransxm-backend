// Check what version is deployed
const https = require('https');

https.get('https://ransxm-api.onrender.com/api/health', (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log('Live API Version:');
        console.log(body);
    });
}).on('error', (e) => {
    console.log('Error:', e.message);
});

