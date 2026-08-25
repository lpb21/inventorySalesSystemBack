/**
 * Recipe Service
 * CRUD de recetas de despiece (plantillas). No ejecuta el despiece —
 * solo guarda/lee las plantillas que luego alimentan a inventoryService.transform.
 */
const { sequelize, Recipe, RecipeItem, Product } = require('../models');
const { NotFoundError, ValidationError } = require('../utils/errors');

class RecipeService {
  // Trae una receta completa (origen + items con sus productos), validando tenant
  async getRecipeById(tenantId, recipeId) {
    const recipe = await Recipe.findOne({
      where: { id: recipeId, tenant_id: tenantId },
      include: [
        { model: Product, as: 'sourceProduct', attributes: ['id', 'name', 'unit'] },
        {
          model: RecipeItem,
          as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'unit'] }],
        },
      ],
    });
    if (!recipe) {
      throw new NotFoundError('Receta no encontrada');
    }
    return recipe;
  }

  // Lista las recetas del tenant (sin items, solo cabecera + origen)
  async getRecipes(tenantId) {
    return await Recipe.findAll({
      where: { tenant_id: tenantId },
      include: [{ model: Product, as: 'sourceProduct', attributes: ['id', 'name', 'unit'] }],
      order: [['created_at', 'DESC']],
    });
  }

  // Crea una receta con sus items (en transacción)
  async createRecipe(tenantId, data) {
    const { name, source_product_id, items } = data;

    if (!Array.isArray(items) || items.length === 0) {
      throw new ValidationError('La receta debe tener al menos un destino');
    }

    return await sequelize.transaction(async (transaction) => {
      // Validar que el producto origen exista y sea del tenant
      const source = await Product.findOne({
        where: { id: source_product_id, tenant_id: tenantId },
        transaction,
      });
      if (!source) {
        throw new NotFoundError('Producto origen no encontrado');
      }

      // Validar que todos los productos destino existan y sean del tenant
      for (const item of items) {
        const prod = await Product.findOne({
          where: { id: item.product_id, tenant_id: tenantId },
          transaction,
        });
        if (!prod) {
          throw new NotFoundError(`Producto destino no encontrado: ${item.product_id}`);
        }
        if (item.product_id === source_product_id) {
          throw new ValidationError('El producto origen no puede ser también un destino');
        }
      }

      // Crear la cabecera
      const recipe = await Recipe.create({
        tenant_id: tenantId,
        name,
        source_product_id,
      }, { transaction });

      // Crear los items
      await RecipeItem.bulkCreate(
        items.map((item) => ({
          recipe_id: recipe.id,
          product_id: item.product_id,
          quantity: item.quantity,
        })),
        { transaction }
      );

      return recipe;
    });
  }

  // Actualiza una receta: reemplaza cabecera e items (en transacción)
  async updateRecipe(tenantId, recipeId, data) {
    const { name, source_product_id, items, is_active } = data;

    return await sequelize.transaction(async (transaction) => {
      const recipe = await Recipe.findOne({
        where: { id: recipeId, tenant_id: tenantId },
        transaction,
      });
      if (!recipe) {
        throw new NotFoundError('Receta no encontrada');
      }

      // Actualizar cabecera (solo los campos enviados)
      await recipe.update({
        ...(name !== undefined && { name }),
        ...(source_product_id !== undefined && { source_product_id }),
        ...(is_active !== undefined && { is_active }),
      }, { transaction });

      // Si mandan items, reemplazamos todos (borrar los viejos, crear los nuevos)
      if (Array.isArray(items)) {
        if (items.length === 0) {
          throw new ValidationError('La receta debe tener al menos un destino');
        }
        await RecipeItem.destroy({ where: { recipe_id: recipe.id }, transaction });
        await RecipeItem.bulkCreate(
          items.map((item) => ({
            recipe_id: recipe.id,
            product_id: item.product_id,
            quantity: item.quantity,
          })),
          { transaction }
        );
      }

      return recipe;
    });
  }

  // Borra una receta (los items se borran solos por el CASCADE de la FK)
  async deleteRecipe(tenantId, recipeId) {
    const recipe = await Recipe.findOne({
      where: { id: recipeId, tenant_id: tenantId },
    });
    if (!recipe) {
      throw new NotFoundError('Receta no encontrada');
    }
    await recipe.destroy();
    return { id: recipeId, deleted: true };
  }
}

module.exports = new RecipeService();