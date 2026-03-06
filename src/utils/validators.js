/**
 * Input Validators using Joi
 */
const Joi = require('joi');

// Common validation schemas
const uuidSchema = Joi.string().uuid().optional();
const requiredUUID = Joi.string().uuid().required();
const requiredString = Joi.string().required().max(255);
const optionalString = Joi.string().optional().max(255).allow(null, '');
const requiredNumber = Joi.number().required();
const optionalNumber = Joi.number().optional().allow(null);
const requiredBoolean = Joi.boolean().required();
const optionalBoolean = Joi.boolean().optional().allow(null);

// Auth schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required().min(6),
});

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required().min(6),
  name: requiredString,
  business_name: requiredString,
  slug: Joi.string().alphanum().lowercase().min(3).max(50).required(),
});

// Tenant schemas
const createTenantSchema = Joi.object({
  name: requiredString.max(255),
  slug: Joi.string().alphanum().lowercase().min(3).max(50).required(),
  business_name: optionalString,
  email: Joi.string().email().optional().allow(null, ''),
  address: Joi.string().required().max(500).messages({
    'any.required': 'La dirección es requerida',
    'string.empty': 'La dirección es requerida'
  }),
  phone: Joi.string().required().max(50).messages({
    'any.required': 'El teléfono es requerido',
    'string.empty': 'El teléfono es requerido'
  }),
  plan: Joi.string().valid('free', 'basic', 'pro', 'enterprise').required().messages({
    'any.required': 'El plan es requerido',
    'any.only': 'El plan debe ser: free, basic, pro o enterprise'
  }),
  subscription_end_date: Joi.string().required().messages({
    'any.required': 'La fecha de terminación es requerida',
    'string.empty': 'La fecha de terminación es requerida'
  }),
  owner_name: requiredString.max(255),
  owner_email: Joi.string().email().required(),
  owner_password: Joi.string().required().min(6),
});

const updateTenantSchema = Joi.object({
  name: optionalString,
  business_name: optionalString,
  address: Joi.string().optional().max(500),
  phone: Joi.string().optional().max(50),
  plan: Joi.string().valid('free', 'basic', 'pro', 'enterprise').optional(),
});

// User schemas
const createUserSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required().min(6),
  name: requiredString,
  role: Joi.string().valid('owner', 'admin', 'supervisor', 'cashier').required(),
  is_active: optionalBoolean.default(true),
});

const updateUserSchema = Joi.object({
  email: Joi.string().email().optional(),
  name: optionalString,
  role: Joi.string().valid('owner', 'admin', 'supervisor', 'cashier').optional(),
  is_active: optionalBoolean,
});

const resetPasswordSchema = Joi.object({
  password: Joi.string().required().min(6),
});

// Category schemas
const categorySchema = Joi.object({
  name: requiredString.max(100),
  description: Joi.string().optional().max(500),
  icon: optionalString.max(50),
  is_active: optionalBoolean.default(true),
});

const updateCategorySchema = categorySchema.fork(
  ['name'],
  (schema) => schema.optional()
);

// Product schemas
const productSchema = Joi.object({
  name: requiredString.max(255),
  category_id: requiredUUID.allow(null, ''),
  description: optionalString,
  sku: optionalString.max(50),
  barcode: optionalString.max(100),
  price: requiredNumber.positive(),
  cost: optionalNumber.positive().allow(0),
  stock: optionalNumber.min(0).default(0),
  min_stock: optionalNumber.min(0).default(0),
  unit: Joi.string().valid('kg', 'lb', 'und', 'paq', 'l', 'ml').default('und'),
  type: Joi.string().valid('weight', 'unit', 'portion').default('unit'),
  image_url: optionalString,
  expiry_date: Joi.string().optional().allow(null, ''),
  is_active: optionalBoolean.default(true),
});

const updateProductSchema = productSchema.fork(
  ['name', 'category_id', 'price'],
  (schema) => schema.optional()
);

// Inventory schemas
const inventoryAdjustmentSchema = Joi.object({
  product_id: requiredUUID,
  quantity: requiredNumber,
  type: Joi.string().valid('in', 'out', 'adjustment', 'sale', 'waste', 'return', 'transfer').required(),
  reason: Joi.string().optional().max(500),
});

// Sale schemas
const saleSchema = Joi.object({
  customer_id: uuidSchema.allow(null, ''),
  customer_name: optionalString,
  customer_document: optionalString.max(50),
  subtotal: requiredNumber.min(0),
  discount: optionalNumber.min(0).default(0),
  tax: optionalNumber.min(0).default(0),
  total: requiredNumber.min(0),
  payment_method: Joi.string().valid('cash', 'card', 'transfer', 'credit').required(),
  payment_received: optionalNumber.min(0).default(0),
  change_given: optionalNumber.min(0).default(0),
  note: optionalString,
  items: Joi.array().items(
    Joi.object({
      product_id: requiredUUID,
      quantity: requiredNumber.positive(),
      unit_price: requiredNumber.positive(),
      total_price: optionalNumber.positive(), // calculado automáticamente si no se envía
    })
  ).min(1).required(),
});


const cancelSaleSchema = Joi.object({
  reason: Joi.string().required().max(500),
});

module.exports = {
  // Auth
  loginSchema,
  registerSchema,
  
  // Tenant
  createTenantSchema,
  updateTenantSchema,
  
  // Users
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
  
  // Categories
  categorySchema,
  updateCategorySchema,
  
  // Products
  productSchema,
  updateProductSchema,
  
  // Inventory
  inventoryAdjustmentSchema,
  
  // Sales
  saleSchema,
  cancelSaleSchema,
  
  // Common
  uuidSchema,
  requiredUUID,
};
