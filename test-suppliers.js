const http = require('http');

function makeRequest(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({status: res.statusCode, data}));
        }).on('error', reject);
    });
}

async function testSuppliersEndpoint() {
    console.log('🔍 Testing suppliers endpoint...');
    
    try {
        // Test basic endpoint
        console.log('\n1. Testing GET /v1/suppliers without auth:');
        const response1 = await makeRequest('http://localhost:3000/v1/suppliers');
        console.log('Status:', response1.status);
        console.log('Response:', response1.data);
        
        // Test health endpoint for comparison
        console.log('\n2. Testing GET /health for comparison:');
        const response2 = await makeRequest('http://localhost:3000/health');
        console.log('Status:', response2.status);
        console.log('Response:', response2.data);
        
        // Test base API route
        console.log('\n3. Testing GET /v1/ base route:');
        const response3 = await makeRequest('http://localhost:3000/v1/');
        console.log('Status:', response3.status);
        console.log('Response:', response3.data);
        
    } catch (error) {
        console.error('❌ Error testing endpoint:', error.message);
    }
}

testSuppliersEndpoint();