const { Supplier, Tenant, User } = require('./src/models');

async function debugSuppliersByTenant() {
    console.log('🔍 Debugging suppliers by tenant...\n');
    
    try {
        // 1. Mostrar todos los tenants
        console.log('📋 ALL TENANTS:');
        const allTenants = await Tenant.findAll({
            attributes: ['id', 'name', 'slug', 'business_name'],
            order: [['name', 'ASC']]
        });
        
        allTenants.forEach(tenant => {
            console.log(`  - ${tenant.name} (${tenant.slug})`);
            console.log(`    ID: ${tenant.id}\n`);
        });

        // 2. Mostrar todos los suppliers con sus tenant_ids
        console.log('🏪 ALL SUPPLIERS:');
        const allSuppliers = await Supplier.findAll({
            attributes: ['id', 'tenant_id', 'name', 'is_active'],
            include: [{
                model: Tenant,
                as: 'tenant',
                attributes: ['name', 'slug']
            }],
            order: [['name', 'ASC']]
        });
        
        if (allSuppliers.length === 0) {
            console.log('  ❌ No suppliers found in database');
        } else {
            allSuppliers.forEach(supplier => {
                console.log(`  - ${supplier.name} (Active: ${supplier.is_active})`);
                console.log(`    Supplier ID: ${supplier.id}`);
                console.log(`    Tenant ID: ${supplier.tenant_id}`);
                console.log(`    Tenant Name: ${supplier.tenant?.name || 'NOT FOUND'}\n`);
            });
        }

        // 3. Buscar suppliers para el tenant específico problemático
        const problemTenantId = '3fd8bd3c-3c8b-4efd-b31a-3a2be3d197fb';
        console.log(`🎯 SUPPLIERS FOR PROBLEM TENANT: ${problemTenantId}`);
        
        const suppliersForProblemTenant = await Supplier.findAll({
            where: { 
                tenant_id: problemTenantId,
                is_active: true 
            },
            attributes: ['id', 'name', 'tenant_id', 'is_active', 'created_at']
        });
        
        if (suppliersForProblemTenant.length === 0) {
            console.log('  ❌ No actives suppliers found for this tenant');
            
            // Buscar suppliers inactivos para este tenant
            const inactiveSuppliers = await Supplier.findAll({
                where: { 
                    tenant_id: problemTenantId,
                    is_active: false 
                },
                attributes: ['id', 'name', 'is_active']
            });
            
            if (inactiveSuppliers.length > 0) {
                console.log('  ⚠️  Found INACTIVE suppliers for this tenant:');
                inactiveSuppliers.forEach(supplier => {
                    console.log(`    - ${supplier.name} (Active: ${supplier.is_active})`);
                });
            }
        } else {
            console.log(`  ✅ Found ${suppliersForProblemTenant.length} active suppliers:`);
            suppliersForProblemTenant.forEach(supplier => {
                console.log(`    - ${supplier.name} (${supplier.id})`);
                console.log(`      Created: ${supplier.created_at}`);
            });
        }

        // 4. Verificar si el tenant problemático existe
        const problemTenant = await Tenant.findByPk(problemTenantId);
        console.log(`\n🏢 PROBLEM TENANT INFO:`);
        if (problemTenant) {
            console.log(`  ✅ Tenant exists: ${problemTenant.name}`);
            console.log(`  Slug: ${problemTenant.slug}`);
            console.log(`  Active: ${problemTenant.is_active}`);
        } else {
            console.log(`  ❌ Tenant NOT FOUND in database`);
        }

        // 5. Buscar usuarios para este tenant
        console.log(`\n👥 USERS FOR PROBLEM TENANT:`);
        const usersForProblemTenant = await User.findAll({
            where: { tenant_id: problemTenantId },
            attributes: ['id', 'name', 'email', 'role', 'is_active']
        });
        
        if (usersForProblemTenant.length === 0) {
            console.log('  ❌ No users found for this tenant');
        } else {
            usersForProblemTenant.forEach(user => {
                console.log(`  - ${user.name} (${user.email})`);
                console.log(`    Role: ${user.role}, Active: ${user.is_active}`);
            });
        }

    } catch (error) {
        console.error('❌ Error debugging suppliers:', error);
    }
    
    process.exit(0);
}

debugSuppliersByTenant();