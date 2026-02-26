/**
 * Database Seed Script
 * Creates initial data for testing
 */
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function seed() {
  const { sequelize, Tenant, User, Category, Product, Customer } = require('../models');
  
  try {
    console.log('🌱 Iniciando seed de datos...');
    
    // Create Tenant
    const tenant = await Tenant.findOne({ where: { slug: 'mi-salsamentaria' } });
    let tenantId;
    
    if (!tenant) {
      const newTenant = await Tenant.create({
        id: uuidv4(),
        name: 'Mi Salsamentaría',
        slug: 'misalsamentaria',
        business_name: 'Mi Salsamentaría C.A.',
        address: 'Calle Principal #123',
        phone: '+57 300 123 4567',
        email: 'contacto@mi-salsamentaria.com',
        plan: 'free',
        subscription_status: 'active',
        is_active: true
      });
      tenantId = newTenant.id;
      console.log('✓ Tenant creado:', newTenant.name);
    } else {
      tenantId = tenant.id;
      console.log('✓ Tenant ya existe:', tenant.name);
    }
    
    // Create User (Owner)
    const userExists = await User.findOne({ 
      where: { tenant_id: tenantId, email: 'admin@mi-salsamentaria.com' }
    });
    
    if (!userExists) {
      const passwordHash = await bcrypt.hash('admin123', 12);
      await User.create({
        id: uuidv4(),
        tenant_id: tenantId,
        name: 'Administrador',
        email: 'admin@mi-salsamentaria.com',
        password_hash: passwordHash,
        role: 'owner',
        is_active: true,
        is_superadmin: false
      });
      console.log('✓ Usuario creado: admin@mi-salsamentaria.com / admin123');
    } else {
      console.log('✓ Usuario ya existe');
    }
    
    // Create Categories
    const categories = [
      { name: 'Carnes Frías', icon: 'meat' },
      { name: 'Quesos', icon: 'cheese' },
      { name: 'Embutidos', icon: 'sausage' },
      { name: 'Lácteos', icon: 'milk' },
      { name: 'Acompañantes', icon: 'bread' }
    ];
    
    const createdCategories = [];
    for (const cat of categories) {
      const existingCat = await Category.findOne({
        where: { tenant_id: tenantId, name: cat.name }
      });
      
      if (!existingCat) {
        const newCat = await Category.create({
          id: uuidv4(),
          tenant_id: tenantId,
          name: cat.name,
          description: `Categoría de ${cat.name.toLowerCase()}`,
          icon: cat.icon,
          is_active: true
        });
        createdCategories.push(newCat);
        console.log('✓ Categoría creada:', cat.name);
      }
    }
    
    if (createdCategories.length === 0) {
      const allCats = await Category.findAll({ where: { tenant_id: tenantId } });
      createdCategories.push(...allCats);
      console.log('✓ Categorías ya existen');
    }
    
    // Create Products
    const products = [
      { name: 'Jamón dulce', sku: 'JAM-001', barcode: '770123456001', price: 15000, cost: 10000, stock: 50, min_stock: 10, unit: 'kg', type: 'weight' },
      { name: 'Queso mozzarella', sku: 'MOZ-001', barcode: '770123456002', price: 18000, cost: 12000, stock: 30, min_stock: 5, unit: 'kg', type: 'weight' },
      { name: 'Salchicha', sku: 'SAL-001', barcode: '770123456003', price: 12000, cost: 8000, stock: 40, min_stock: 15, unit: 'kg', type: 'weight' },
      { name: 'Leche entera', sku: 'LEC-001', barcode: '770123456004', price: 5500, cost: 3800, stock: 100, min_stock: 20, unit: 'und', type: 'unit' },
      { name: 'Yogurt griego', sku: 'YOG-001', barcode: '770123456005', price: 6500, cost: 4200, stock: 60, min_stock: 10, unit: 'und', type: 'unit' },
      { name: 'Mortadela', sku: 'MOR-001', barcode: '770123456006', price: 14000, cost: 9500, stock: 25, min_stock: 8, unit: 'kg', type: 'weight' },
      { name: 'Queso parmesan', sku: 'PAR-001', barcode: '770123456007', price: 25000, cost: 18000, stock: 15, min_stock: 3, unit: 'kg', type: 'weight' },
      { name: 'Tocino', sku: 'TOC-001', barcode: '770123456008', price: 16000, cost: 11000, stock: 20, min_stock: 5, unit: 'kg', type: 'weight' },
      { name: 'Huevos blancos', sku: 'HUE-001', barcode: '770123456009', price: 450, cost: 320, stock: 500, min_stock: 100, unit: 'und', type: 'unit' },
      { name: 'Mantequilla', sku: 'MAN-001', barcode: '770123456010', price: 8000, cost: 5500, stock: 35, min_stock: 10, unit: 'und', type: 'unit' }
    ];
    
    for (const prod of products) {
      const existingProd = await Product.findOne({
        where: { tenant_id: tenantId, sku: prod.sku }
      });
      
      if (!existingProd) {
        const categoryIndex = Math.floor(Math.random() * createdCategories.length);
        await Product.create({
          id: uuidv4(),
          tenant_id: tenantId,
          category_id: createdCategories[categoryIndex]?.id || null,
          name: prod.name,
          description: `${prod.name} de alta calidad`,
          sku: prod.sku,
          barcode: prod.barcode,
          price: prod.price,
          cost: prod.cost,
          stock: prod.stock,
          min_stock: prod.min_stock,
          unit: prod.unit,
          type: prod.type,
          is_active: true
        });
        console.log('✓ Producto creado:', prod.name);
      }
    }
    
    // Create a sample customer
    const customerExists = await Customer.findOne({
      where: { tenant_id: tenantId, document: '12345678' }
    });
    
    if (!customerExists) {
      await Customer.create({
        id: uuidv4(),
        tenant_id: tenantId,
        name: 'Cliente Frequent',
        document: '12345678',
        phone: '+57 310 987 6543',
        email: 'cliente@email.com',
        address: 'Carrera 10 #20-30',
        is_active: true
      });
      console.log('✓ Cliente creado: Cliente Frequent');
    }
    
    console.log('\n🎉 Seed completado exitosamente!');
    console.log('\n📋 Datos de acceso:');
    console.log('   Email: admin@mi-salsamentaria.com');
    console.log('   Contraseña: admin123');
    console.log('\n🌐 Endpoint base: http://localhost:3000/v1');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en seed:', error);
    process.exit(1);
  }
}

