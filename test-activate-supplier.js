const http = require('http');

// 1. FUNCIÓN PARA HACER LOGIN Y OBTENER TOKEN
async function login() {
    const loginData = JSON.stringify({
        email: 'admin@caro.com', // Usuario del tenant problemático
        password: 'contraseña_aquí' // Reemplaza con la contraseña correcta
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

    return new Promise((resolve, reject) => {
        const req = http.request(loginOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    const result = JSON.parse(data);
                    resolve(result.data.token);
                } else {
                    reject(new Error(`Login failed: ${data}`));
                }
            });
        });
        req.on('error', reject);
        req.write(loginData);
        req.end();
    });
}

// 2. FUNCIÓN PARA ACTIVAR SUPPLIER
async function toggleSupplierStatus(token, supplierId) {
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: `/v1/suppliers/${supplierId}/toggle-status`,
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({
                status: res.statusCode,
                data: data
            }));
        });
        req.on('error', reject);
        req.end(); // No body needed for PATCH
    });
}

// 3. FUNCIÓN PARA VERIFICAR SUPPLIERS DESPUÉS
async function getSuppliers(token) {
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/v1/suppliers',
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({
                status: res.statusCode,
                data: data
            }));
        });
        req.on('error', reject);
        req.end();
    });
}

// SCRIPT PRINCIPAL
async function testActivateSupplier() {
    console.log('🔄 Testing supplier activation...\n');
    
    try {
        // Supplier ID del debug anterior
        const supplierId = '02161233-8699-4352-a974-9a3d53ca3a4e';

        // 1. Login
        console.log('1️⃣ Logging in...');
        const token = await login();
        console.log('✅ Login successful!\n');

        // 2. Toggle supplier status
        console.log('2️⃣ Toggling supplier status...');
        const toggleResponse = await toggleSupplierStatus(token, supplierId);
        console.log('Status:', toggleResponse.status);
        console.log('Response:', toggleResponse.data);
        console.log('');

        // 3. Verify suppliers list
        console.log('3️⃣ Verifying suppliers list...');
        const suppliersResponse = await getSuppliers(token);
        console.log('Status:', suppliersResponse.status);
        
        if (suppliersResponse.status === 200) {
            const parsedResponse = JSON.parse(suppliersResponse.data);
            const supplierCount = parsedResponse.data?.suppliers?.length || 0;
            console.log(`✅ Found ${supplierCount} active suppliers`);
            
            if (supplierCount > 0) {
                console.log('📋 Active suppliers:');
                parsedResponse.data.suppliers.forEach(supplier => {
                    console.log(`   - ${supplier.name} (${supplier.is_active ? 'ACTIVE' : 'INACTIVE'})`);
                });
            }
        } else {
            console.log('❌ Failed to get suppliers:', suppliersResponse.data);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testActivateSupplier();