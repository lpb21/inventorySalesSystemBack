const http = require('http');

function makeRequest(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: url.replace('http://localhost:3000', ''),
            method: 'GET',
            headers
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({
                status: res.statusCode,
                headers: res.headers,
                data
            }));
        });

        req.on('error', reject);
        req.end();
    });
}

async function testSuppliersWithAuth() {
    console.log('🔍 Testing suppliers endpoint with authentication...');
    
    try {
        // First, let's try to login and get a token
        console.log('\n1. Testing login to get token:');
        const loginData = JSON.stringify({
            email: 'admin@mi-salsamentaria.com', // Usuario correcto del seed
            password: 'admin123'
        });

        const loginOptions = {
            hostname: 'localhost',
            port: 3000,
            path: '/v1/auth/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(loginData)
            }
        };

        const loginResponse = await new Promise((resolve, reject) => {
            const req = http.request(loginOptions, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => resolve({status: res.statusCode, data}));
            });
            req.on('error', reject);
            req.write(loginData);
            req.end();
        });

        console.log('Login Status:', loginResponse.status);
        console.log('Login Response:', loginResponse.data);

        if (loginResponse.status === 200) {
            const loginResult = JSON.parse(loginResponse.data);
            const token = loginResult.data?.token;
            
            if (token) {
                console.log('\n2. Testing suppliers with valid token:');
                const suppliersResponse = await makeRequest('/v1/suppliers', {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                });
                
                console.log('Suppliers Status:', suppliersResponse.status);
                console.log('Suppliers Response:', suppliersResponse.data);
            } else {
                console.log('❌ No token received from login');
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testSuppliersWithAuth();