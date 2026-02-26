# TODO - invLeo Backend Implementation

## Fase 1: Configuración Inicial
- [ ] Crear archivo .env.example con variables de entorno
- [ ] Instalar dependencias npm
- [ ] Crear estructura de carpetas src/

## Fase 2: Configuración Base
- [ ] src/config/database.js - Configuración Sequelize
- [ ] src/config/env.js - Variables de entorno
- [ ] src/app.js - Configuración Express
- [ ] src/server.js - Punto de entrada

## Fase 3: Modelos Sequelize
- [ ] src/models/index.js - Configuración de modelos
- [ ] src/models/Tenant.js
- [ ] src/models/User.js
- [ ] src/models/Category.js
- [ ] src/models/Product.js
- [ ] src/models/InventoryMovement.js
- [ ] src/models/Sale.js
- [ ] src/models/SaleItem.js
- [ ] src/models/Customer.js (opcional)
- [ ] src/models/Supplier.js (opcional)

## Fase 4: Middlewares
- [ ] src/middlewares/authMiddleware.js
- [ ] src/middlewares/tenantMiddleware.js
- [ ] src/middlewares/permissionMiddleware.js
- [ ] src/middlewares/validationMiddleware.js
- [ ] src/middlewares/errorMiddleware.js

## Fase 5: Controladores
- [ ] src/controllers/authController.js
- [ ] src/controllers/tenantController.js
- [ ] src/controllers/userController.js
- [ ] src/controllers/categoryController.js
- [ ] src/controllers/productController.js
- [ ] src/controllers/inventoryController.js
- [ ] src/controllers/saleController.js
- [ ] src/controllers/reportController.js

## Fase 6: Rutas con /v1/
- [ ] src/routes/v1/authRoutes.js
- [ ] src/routes/v1/tenantRoutes.js
- [ ] src/routes/v1/userRoutes.js
- [ ] src/routes/v1/categoryRoutes.js
- [ ] src/routes/v1/productRoutes.js
- [ ] src/routes/v1/inventoryRoutes.js
- [ ] src/routes/v1/saleRoutes.js
- [ ] src/routes/v1/reportRoutes.js
- [ ] src/routes/index.js - Combinar todas las rutas

## Fase 7: Servicios
- [ ] src/services/authService.js
- [ ] src/services/productService.js
- [ ] src/services/saleService.js
- [ ] src/services/inventoryService.js

## Fase 8: Utilidades
- [ ] src/utils/errors.js
- [ ] src/utils/validators.js
- [ ] src/utils/helpers.js

## Fase 9: Sincronización y Prueba
- [ ] Sincronizar modelos con base de datos
- [ ] Probar endpoints básicos
