/**
 * Recipe Controller
 * Endpoints CRUD de recetas de despiece
 */
const recipeService = require('../services/recipeService');
const { asyncHandler, formatResponse } = require('../utils/helpers');

class RecipeController {
  getRecipes = asyncHandler(async (req, res) => {
    const recipes = await recipeService.getRecipes(req.tenantId);
    res.status(200).json(formatResponse(recipes));
  });

  getRecipeById = asyncHandler(async (req, res) => {
    const recipe = await recipeService.getRecipeById(req.tenantId, req.params.id);
    res.status(200).json(formatResponse(recipe));
  });

  createRecipe = asyncHandler(async (req, res) => {
    const recipe = await recipeService.createRecipe(req.tenantId, req.body);
    res.status(201).json(formatResponse(recipe));
  });

  updateRecipe = asyncHandler(async (req, res) => {
    const recipe = await recipeService.updateRecipe(req.tenantId, req.params.id, req.body);
    res.status(200).json(formatResponse(recipe));
  });

  deleteRecipe = asyncHandler(async (req, res) => {
    const result = await recipeService.deleteRecipe(req.tenantId, req.params.id);
    res.status(200).json(formatResponse(result));
  });
}

module.exports = new RecipeController();