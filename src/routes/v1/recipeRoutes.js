/**
 * Recipe Routes
 * CRUD de recetas de despiece
 */
const express = require('express');
const router = express.Router();
const recipeController = require('../../controllers/recipeController');
const authMiddleware = require('../../middlewares/authMiddleware');
const tenantMiddleware = require('../../middlewares/tenantMiddleware');
const { permissionMiddleware } = require('../../middlewares/permissionMiddleware');
const { validate } = require('../../middlewares/validationMiddleware');
const { createRecipeSchema, updateRecipeSchema } = require('../../utils/validators');

router.use(authMiddleware);
router.use(tenantMiddleware);

router.get('/', permissionMiddleware('inventory:read'), recipeController.getRecipes);
router.get('/:id', permissionMiddleware('inventory:read'), recipeController.getRecipeById);
router.post('/', permissionMiddleware('inventory:adjust'), validate(createRecipeSchema), recipeController.createRecipe);
router.put('/:id', permissionMiddleware('inventory:adjust'), validate(updateRecipeSchema), recipeController.updateRecipe);
router.delete('/:id', permissionMiddleware('inventory:adjust'), recipeController.deleteRecipe);

module.exports = router;