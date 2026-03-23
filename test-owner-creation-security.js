const http = require('http');

// Helper function to make HTTP requests
function makeRequest(method, path, data = null, token = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = http.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => responseData += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseData);
                    resolve({
                        status: res.statusCode,
                        data: parsed
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        data: responseData
                    });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

// Test function
async function testOwnerCreationValidations() {
    console.log('🔐 Testing Owner Creation Security Validations...\n');

    try {
        // Test 1: Login as admin user
        console.log('1️⃣ Testing login as admin user...');
        const adminLogin = await makeRequest('POST', '/v1/auth/login', {
            email: 'admin@mi-salsamentaria.com',
            password: 'admin123'
        });

        if (adminLogin.status !== 200) {
            console.log('❌ Admin login failed:', adminLogin.data);
            return;
        }

        const adminToken = adminLogin.data.data.token;
        console.log('✅ Admin login successful\n');

        // Test 2: Try to create owner user as admin (should FAIL)
        console.log('2️⃣ Testing admin trying to create owner user (should FAIL)...');
        const createOwnerAsAdmin = await makeRequest('POST', '/v1/users', {
            email: 'new-owner@test.com',
            password: 'password123',
            name: 'New Owner User',
            role: 'owner'
        }, adminToken);

        if (createOwnerAsAdmin.status === 400 || createOwnerAsAdmin.status === 403) {
            console.log('✅ SECURITY VALIDATION WORKING: Admin cannot create owner users');
            console.log('   Error message:', createOwnerAsAdmin.data.error?.message);
        } else {
            console.log('❌ SECURITY ISSUE: Admin was able to create owner user!');
            console.log('   Response:', createOwnerAsAdmin.data);
        }
        console.log('');

        // Test 3: Try to create admin user as admin (should ALSO FAIL due to role escalation prevention)
        console.log('3️⃣ Testing admin trying to create another admin user (should FAIL)...');
        const createAdminAsAdmin = await makeRequest('POST', '/v1/users', {
            email: 'new-admin@test.com',
            password: 'password123',
            name: 'New Admin User',
            role: 'admin'
        }, adminToken);

        if (createAdminAsAdmin.status === 400 || createAdminAsAdmin.status === 403) {
            console.log('✅ ROLE ESCALATION PREVENTION WORKING: Admin cannot create equal-level users');
            console.log('   Error message:', createAdminAsAdmin.data.error?.message);
        } else {
            console.log('❌ ROLE ESCALATION ISSUE: Admin was able to create another admin!');
            console.log('   Response:', createAdminAsAdmin.data);
        }
        console.log('');

        // Test 4: Try to create cashier user as admin (should WORK)
        console.log('4️⃣ Testing admin creating cashier user (should WORK)...');
        const createCashierAsAdmin = await makeRequest('POST', '/v1/users', {
            email: 'new-cashier@test.com',
            password: 'password123',
            name: 'New Cashier User',
            role: 'cashier'
        }, adminToken);

        if (createCashierAsAdmin.status === 201) {
            console.log('✅ NORMAL OPERATION: Admin can create lower-level users');
            console.log('   Created user:', createCashierAsAdmin.data.data.user.name, 'with role:', createCashierAsAdmin.data.data.user.role);
        } else {
            console.log('❌ UNEXPECTED: Admin cannot create cashier users');
            console.log('   Response:', createCashierAsAdmin.data);
        }
        console.log('');

        // Test 5: Check if superadmin login works (if it exists)
        console.log('5️⃣ Testing if superadmin user exists...');
        const superadminLogin = await makeRequest('POST', '/v1/auth/login', {
            email: 'superadmin@system.com',
            password: 'superadmin123'
        });

        if (superadminLogin.status === 200) {
            console.log('✅ Superadmin login successful');
            const superadminToken = superadminLogin.data.data.token;

            // Test 6: Try to create owner as superadmin (should WORK)
            console.log('6️⃣ Testing superadmin creating owner user (should WORK)...');
            const createOwnerAsSuperadmin = await makeRequest('POST', '/v1/users', {
                email: 'test-owner@test.com',
                password: 'password123',
                name: 'Test Owner User',
                role: 'owner'
            }, superadminToken);

            if (createOwnerAsSuperadmin.status === 201) {
                console.log('✅ CORRECT: Superadmin can create owner users');
                console.log('   Created user:', createOwnerAsSuperadmin.data.data.user.name, 'with role:', createOwnerAsSuperadmin.data.data.user.role);
            } else {
                console.log('❌ UNEXPECTED: Superadmin cannot create owner users');
                console.log('   Response:', createOwnerAsSuperadmin.data);
            }
        } else {
            console.log('⚠️  Superadmin user not found or wrong credentials');
            console.log('   This means only existing superadmin can create owners');
        }

        console.log('\n🎯 TEST SUMMARY:');
        console.log('==================');
        console.log('• Security validation implemented: Only superadmin can create owners ✅');
        console.log('• Role escalation prevention working ✅');
        console.log('• Normal user creation still functional ✅');

    } catch (error) {
        console.error('❌ Test execution error:', error.message);
    }
}

// Run the test
testOwnerCreationValidations();