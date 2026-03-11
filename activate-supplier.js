const { Supplier } = require('./src/models');

async function activateInactiveSupplier() {
    console.log('🔄 Activating inactive supplier...\n');
    
    try {
        const tenantId = '3fd8bd3c-3c8b-4efd-b31a-3a2be3d197fb';
        const supplierName = 'comercializadora el perrito feliz';
        
        // Buscar y activar el supplier
        const supplier = await Supplier.findOne({
            where: { 
                tenant_id: tenantId,
                name: supplierName
            }
        });
        
        if (supplier) {
            await supplier.update({ is_active: true });
            console.log('✅ Supplier activated successfully!');
            console.log(`   Name: ${supplier.name}`);
            console.log(`   ID: ${supplier.id}`);
            console.log(`   Tenant: ${tenantId}`);
            console.log(`   Status: ${supplier.is_active ? 'ACTIVE' : 'INACTIVE'}`);
        } else {
            console.log('❌ Supplier not found');
        }
        
    } catch (error) {
        console.error('❌ Error activating supplier:', error);
    }
    
    process.exit(0);
}

activateInactiveSupplier();