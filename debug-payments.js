const { Customer, Sale } = require('./src/models');

async function debugPaymentEndpoint() {
    console.log('🔍 Debugging customer payment endpoint...\n');
    
    try {
        // 1. Buscar clientes con deuda de crédito
        console.log('👥 CUSTOMERS WITH CREDIT BALANCE:');
        const customersWithCredit = await Customer.findAll({
            where: {
                credit_balance: { [require('sequelize').Op.gt]: 0 }
            },
            attributes: ['id', 'tenant_id', 'name', 'document', 'credit_balance', 'credit_limit'],
            include: [{
                model: require('./src/models').Tenant,
                as: 'tenant',
                attributes: ['name', 'slug']
            }],
            order: [['credit_balance', 'DESC']]
        });

        if (customersWithCredit.length === 0) {
            console.log('  ❌ No customers with credit balance found');
            
            // Buscar ventas a crédito para ver si hay clientes con transacciones
            console.log('\n💳 CHECKING CREDIT SALES:');
            const creditSales = await Sale.findAll({
                where: { payment_method: 'credit' },
                attributes: ['id', 'customer_id', 'total', 'tenant_id'],
                include: [{
                    model: Customer,
                    as: 'customer',
                    attributes: ['name', 'credit_balance']
                }],
                limit: 5
            });
            
            if (creditSales.length > 0) {
                console.log(`  ✅ Found ${creditSales.length} credit sales:`);
                creditSales.forEach(sale => {
                    console.log(`    - Sale ID: ${sale.id}, Customer: ${sale.customer?.name}, Balance: ${sale.customer?.credit_balance}`);
                });
            } else {
                console.log('  ❌ No credit sales found');
            }
        } else {
            console.log(`  ✅ Found ${customersWithCredit.length} customers with credit balance:`);
            customersWithCredit.forEach(customer => {
                console.log(`    - ${customer.name} (${customer.document || 'No doc'})`);
                console.log(`      ID: ${customer.id}`);
                console.log(`      Tenant: ${customer.tenant?.name} (${customer.tenant_id})`);
                console.log(`      Balance: $${customer.credit_balance}`);
                console.log(`      Limit: $${customer.credit_limit}\n`);
            });
        }

        // 2. Verificar estructura de base de datos
        console.log('🗄️  DATABASE STRUCTURE CHECK:');
        
        // Verificar campo credit_balance en Customer
        const customerColumns = await require('./src/models').sequelize.getQueryInterface().describeTable('customers');
        if (customerColumns.credit_balance) {
            console.log('  ✅ customers.credit_balance column exists');
            console.log(`      Type: ${customerColumns.credit_balance.type}`);
            console.log(`      Allow Null: ${customerColumns.credit_balance.allowNull}`);
            console.log(`      Default: ${customerColumns.credit_balance.defaultValue}`);
        } else {
            console.log('  ❌ customers.credit_balance column MISSING');
        }

        // 3. Probar validaciones de ejemplo
        console.log('\n🧪 TESTING PAYMENT VALIDATIONS:');
        
        const testCases = [
            { amount: 0, note: 'Test zero amount' },
            { amount: -100, note: 'Test negative amount' },
            { amount: 50000, note: 'Test valid amount' },
            { amount: '50000', note: 'Test string amount' },
            { amount: null, note: 'Test null amount' }
        ];

        testCases.forEach(testCase => {
            try {
                const amount = parseFloat(testCase.amount);
                const isValid = !isNaN(amount) && amount > 0;
                console.log(`    Amount: ${testCase.amount} → Parsed: ${amount} → Valid: ${isValid ? '✅' : '❌'}`);
            } catch (error) {
                console.log(`    Amount: ${testCase.amount} → Error: ❌ ${error.message}`);
            }
        });

        // 4. Simular el proceso de pago (sin ejecutar)
        if (customersWithCredit.length > 0) {
            const testCustomer = customersWithCredit[0];
            console.log(`\n🎯 PAYMENT SIMULATION FOR: ${testCustomer.name}`);
            console.log(`    Current Balance: $${testCustomer.credit_balance}`);
            
            const testPayments = [10000, 25000, 50000, 100000];
            testPayments.forEach(payment => {
                const currentBalance = parseFloat(testCustomer.credit_balance);
                const newBalance = currentBalance - payment;
                const isValid = payment <= currentBalance;
                
                console.log(`    Payment $${payment} → New Balance: $${newBalance} → Valid: ${isValid ? '✅' : '❌'}`);
                if (!isValid) {
                    console.log(`      Error: Payment exceeds current balance ($${currentBalance})`);
                }
            });
        }

    } catch (error) {
        console.error('❌ Error during debug:', error);
        console.error('Stack:', error.stack);
    }
    
    process.exit(0);
}

debugPaymentEndpoint();