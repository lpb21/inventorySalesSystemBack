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
const { uploadLimiter, writeOperationsLimiter, imageUploadLimiter, barcodeLookupLimiter } = require('../../middlewares/rateLimitMiddleware');
const env = require('../../config/env');
const fs = require('fs');

// Configure multer for CSV file upload
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'products-' + uniqueSuffix + '.csv');
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos CSV'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Multer para imágenes de producto: en memoria (sharp procesa el buffer, nada toca el disco)
const ALLOWED_IMAGE_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif', 'image/gif'];

const imageUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    // Primer filtro barato; la validación real la hace sharp leyendo el contenido
    if (ALLOWED_IMAGE_MIMETYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes JPG, PNG o WebP'), false);
    }
  },
  limits: { fileSize: env.productImages.maxUploadBytes, files: 1 },
});

const handleImageUpload = (req, res, next) => {
  imageUpload.single('image')(req, res, (err) => {
    if (err) {
      const maxMb = Math.round(env.productImages.maxUploadBytes / (1024 * 1024));
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? `La imagen supera el tamaño máximo de ${maxMb}MB`
        : err.message;
      return res.status(400).json({
        success: false,
        error: {
          code: 'FILE_UPLOAD_ERROR',
          message,
        },
      });
    }
    next();
  });
};

// Apply auth and tenant middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// Add debug logging middleware
router.use((req, res, next) => {
  next();
});

// Product routes
router.get('/', permissionMiddleware('products:read'), productController.getProducts);
router.post('/', writeOperationsLimiter, permissionMiddleware('products:create'), validate(productSchema), productController.createProduct);
router.post('/import', uploadLimiter, permissionMiddleware('products:create'), (req, res, next) => {
  
  const uploadHandler = upload.single('file');
  
  uploadHandler(req, res, (err) => {
    
    // Ignorar el error "Field name missing" si el archivo se subió correctamente
    if (err && err.code === 'MISSING_FIELD_NAME' && req.file) {
      return next();
    }
    
    if (err) {
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
router.get('/expiring-soon', permissionMiddleware('products:read'), productController.getExpiringSoon);
router.get('/expired', permissionMiddleware('products:read'), productController.getExpired);
router.get('/search', permissionMiddleware('products:read'), productController.searchProducts);
router.get('/barcode/:code', permissionMiddleware('products:read'), productController.getProductByBarcode);
router.get('/lookup/:barcode', barcodeLookupLimiter, permissionMiddleware('products:read'), productController.lookupBarcode);
router.get('/:id', permissionMiddleware('products:read'), productController.getProductById);
router.put('/:id', writeOperationsLimiter, permissionMiddleware('products:update'), validate(updateProductSchema), productController.updateProduct);
router.delete('/:id', permissionMiddleware('products:delete'), productController.deleteProduct);

// Imagen del producto (una sola por producto, se sobrescribe)
router.put('/:id/image', imageUploadLimiter, permissionMiddleware('products:update'), handleImageUpload, productController.uploadImage);
router.delete('/:id/image', writeOperationsLimiter, permissionMiddleware('products:update'), productController.deleteImage);
router.post('/:id/image/lookup', barcodeLookupLimiter, permissionMiddleware('products:update'), productController.lookupImage);

module.exports = router;
