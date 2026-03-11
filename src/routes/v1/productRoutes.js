/**
 * Product Routes
 * Routes for product management endpoints
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const productController = require('../../controllers/productController');
const authMiddleware = require('../../middlewares/authMiddleware');
const tenantMiddleware = require('../../middlewares/tenantMiddleware');
const { permissionMiddleware } = require('../../middlewares/permissionMiddleware');
const { validate } = require('../../middlewares/validationMiddleware');
const { productSchema, updateProductSchema } = require('../../utils/validators');
const { uploadLimiter, writeOperationsLimiter } = require('../../middlewares/rateLimitMiddleware');
const fs = require('fs');

// Configure multer for CSV file upload
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log('[MULTER DEBUG] Configurando destino del archivo');
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    console.log('[MULTER DEBUG] Generando nombre de archivo:', 'products-' + uniqueSuffix + '.csv');
    cb(null, 'products-' + uniqueSuffix + '.csv');
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    console.log('[MULTER DEBUG] Validando archivo:', file.originalname, 'mimetype:', file.mimetype);
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      console.log('[MULTER DEBUG] Archivo CSV válido');
      cb(null, true);
    } else {
      console.log('[MULTER DEBUG] ERROR: Archivo no es CSV');
      cb(new Error('Solo se permiten archivos CSV'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Apply auth and tenant middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// Add debug logging middleware
router.use((req, res, next) => {
  console.log('[ROUTER DEBUG] Petición procesada por middlewares base. Ruta:', req.method, req.path);
  console.log('[ROUTER DEBUG] req.user:', req.user ? req.user.id : 'NO USER');
  console.log('[ROUTER DEBUG] req.tenantId:', req.tenantId);
  next();
});

// Product routes
router.get('/', permissionMiddleware('products:read'), productController.getProducts);
router.post('/', writeOperationsLimiter, permissionMiddleware('products:create'), validate(productSchema), productController.createProduct);
router.post('/import', uploadLimiter, permissionMiddleware('products:create'), (req, res, next) => {
  console.log('[ROUTE DEBUG] Antes de upload.single');
  
  const uploadHandler = upload.single('file');
  
  uploadHandler(req, res, (err) => {
    console.log('[ROUTE DEBUG] Después de upload.single');
    console.log('[ROUTE DEBUG] Error:', err ? err.message : 'NINGUNO');
    console.log('[ROUTE DEBUG] req.file:', req.file ? 'EXISTE' : 'NO EXISTE');
    console.log('[ROUTE DEBUG] req.body:', req.body);
    
    // Ignorar el error "Field name missing" si el archivo se subió correctamente
    if (err && err.code === 'MISSING_FIELD_NAME' && req.file) {
      console.log('[ROUTE DEBUG] Error MISSING_FIELD_NAME ignorado porque el archivo existe');
      return next();
    }
    
    if (err) {
      console.log('[ROUTE DEBUG] Error de Multer:', err);
      return res.status(400).json({
        success: false,
        error: {
          code: 'FILE_UPLOAD_ERROR',
          message: err.message
        }
      });
    }
    next();
  });
}, productController.bulkImport);
router.get('/import/progress/:importId', authMiddleware, tenantMiddleware, productController.getImportProgress);
router.get('/low-stock', permissionMiddleware('products:read'), productController.getLowStock);
router.get('/search', permissionMiddleware('products:read'), productController.searchProducts);
router.get('/barcode/:code', permissionMiddleware('products:read'), productController.getProductByBarcode);
router.get('/:id', permissionMiddleware('products:read'), productController.getProductById);
router.put('/:id', writeOperationsLimiter, permissionMiddleware('products:update'), validate(updateProductSchema), productController.updateProduct);
router.delete('/:id', permissionMiddleware('products:delete'), productController.deleteProduct);

module.exports = router;
