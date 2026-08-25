/**
 * Models Index
 * Imports all models and defines associations
 */
const { sequelize } = require('../config/database');
const Tenant = require('./Tenant');
const User = require('./User');
const Category = require('./Category');
const Product = require('./Product');
const InventoryMovement = require('./InventoryMovement');
const Sale = require('./Sale');
const SaleItem = require('./SaleItem');
const Customer = require('./Customer');
const Supplier = require('./Supplier');
const CashRegister = require('./CashRegister');
const PurchaseOrder = require('./PurchaseOrder');
const PurchaseOrderItem = require('./PurchaseOrderItem');
const AuditLog = require('./AuditLog');
const TenantSubscription = require('./TenantSubscription');
const BillingWebhookEvent = require('./BillingWebhookEvent');
const Recipe = require('./Recipe');
const RecipeItem = require('./RecipeItem');

// =====================
// Tenant associations
// =====================
Tenant.hasMany(User, { foreignKey: 'tenant_id', as: 'users' });
User.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(Category, { foreignKey: 'tenant_id', as: 'categories' });
Category.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(Product, { foreignKey: 'tenant_id', as: 'products' });
Product.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(InventoryMovement, { foreignKey: 'tenant_id', as: 'inventoryMovements' });
InventoryMovement.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(Sale, { foreignKey: 'tenant_id', as: 'sales' });
Sale.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(SaleItem, { foreignKey: 'tenant_id', as: 'saleItems' });
SaleItem.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(Customer, { foreignKey: 'tenant_id', as: 'customers' });
Customer.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(Supplier, { foreignKey: 'tenant_id', as: 'suppliers' });
Supplier.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(CashRegister, { foreignKey: 'tenant_id', as: 'cashRegisters' });
CashRegister.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(PurchaseOrder, { foreignKey: 'tenant_id', as: 'purchaseOrders' });
PurchaseOrder.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

// =====================
// Category - Product
// =====================
Category.hasMany(Product, { foreignKey: 'category_id', as: 'products' });
Product.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

// =====================
// Supplier - Product
// =====================
Supplier.hasMany(Product, { foreignKey: 'supplier_id', as: 'products' });
Product.belongsTo(Supplier, { foreignKey: 'supplier_id', as: 'supplier' });

// Recipe (recetas de despiece)
Tenant.hasMany(Recipe, { foreignKey: 'tenant_id', as: 'recipes' });
Recipe.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

// Una receta tiene un producto origen
Recipe.belongsTo(Product, { foreignKey: 'source_product_id', as: 'sourceProduct' });

// Una receta tiene varios items (destinos)
Recipe.hasMany(RecipeItem, { foreignKey: 'recipe_id', as: 'items' });
RecipeItem.belongsTo(Recipe, { foreignKey: 'recipe_id', as: 'recipe' });

// Cada item apunta a un producto destino
RecipeItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// =====================
// User associations
// =====================
User.hasMany(Sale, { foreignKey: 'user_id', as: 'sales' });
Sale.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(InventoryMovement, { foreignKey: 'user_id', as: 'inventoryMovements' });
InventoryMovement.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(CashRegister, { foreignKey: 'user_id', as: 'cashRegisters' });
CashRegister.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(PurchaseOrder, { foreignKey: 'user_id', as: 'purchaseOrders' });
PurchaseOrder.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// =====================
// Product - InventoryMovement
// =====================
Product.hasMany(InventoryMovement, { foreignKey: 'product_id', as: 'movements' });
InventoryMovement.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// =====================
// Sale - SaleItem
// =====================
Sale.hasMany(SaleItem, { foreignKey: 'sale_id', as: 'items' });
SaleItem.belongsTo(Sale, { foreignKey: 'sale_id', as: 'sale' });

// =====================
// Product - SaleItem
// =====================
Product.hasMany(SaleItem, { foreignKey: 'product_id', as: 'saleItems' });
SaleItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// =====================
// Customer - Sale
// =====================
Customer.hasMany(Sale, { foreignKey: 'customer_id', as: 'sales' });
Sale.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });

// =====================
// CashRegister - Sale
// =====================
CashRegister.hasMany(Sale, { foreignKey: 'cash_register_id', as: 'sales' });
Sale.belongsTo(CashRegister, { foreignKey: 'cash_register_id', as: 'cashRegister' });

// =====================
// Supplier - PurchaseOrder
// =====================
Supplier.hasMany(PurchaseOrder, { foreignKey: 'supplier_id', as: 'purchaseOrders' });
PurchaseOrder.belongsTo(Supplier, { foreignKey: 'supplier_id', as: 'supplier' });

// =====================
// PurchaseOrder - PurchaseOrderItem
// =====================
PurchaseOrder.hasMany(PurchaseOrderItem, { foreignKey: 'purchase_order_id', as: 'items' });
PurchaseOrderItem.belongsTo(PurchaseOrder, { foreignKey: 'purchase_order_id', as: 'purchaseOrder' });

// =====================
// Product - PurchaseOrderItem
// =====================
Product.hasMany(PurchaseOrderItem, { foreignKey: 'product_id', as: 'purchaseOrderItems' });
PurchaseOrderItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// =====================
// AuditLog associations
// =====================
Tenant.hasMany(AuditLog, { foreignKey: 'tenant_id', as: 'auditLogs' });
AuditLog.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

User.hasMany(AuditLog, { foreignKey: 'user_id', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// =====================
// Billing associations
// =====================
Tenant.hasOne(TenantSubscription, { foreignKey: 'tenant_id', as: 'subscription' });
TenantSubscription.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(BillingWebhookEvent, { foreignKey: 'tenant_id', as: 'billingWebhookEvents' });
BillingWebhookEvent.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

// =====================
// Export all models
// =====================
module.exports = {
  sequelize,
  Tenant,
  User,
  Category,
  Product,
  InventoryMovement,
  Sale,
  SaleItem,
  Customer,
  Supplier,
  CashRegister,
  PurchaseOrder,
  PurchaseOrderItem,
  AuditLog,
  TenantSubscription,
  BillingWebhookEvent,
  Recipe,
  RecipeItem
};
