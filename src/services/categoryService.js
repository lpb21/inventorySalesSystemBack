/**
 * Category Service
 * Handles category business logic
 */
const { Op } = require('sequelize');
const { Category, Product } = require('../models');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { getPaginationSkip, formatPagination } = require('../utils/helpers');

class CategoryService {
  /**
   * Create category
   */
  async createCategory(tenantId, categoryData) {
    const { name } = categoryData;

    // Check if category name already exists
    const existingCategory = await Category.findOne({
      where: { tenant_id: tenantId, name },
    });

    if (existingCategory) {
      throw new ValidationError('Ya existe una categoría con este nombre');
    }

    const category = await Category.create({
      ...categoryData,
      tenant_id: tenantId,
    });

    return category;
  }

  /**
   * Get all categories
   */
  async getCategories(tenantId, { page = 1, limit = 20, is_active } = {}) {
    const where = { tenant_id: tenantId };

    // By default, only show active categories
    if (is_active === undefined) {
      where.is_active = true;
    } else if (is_active !== '') {
      where.is_active = is_active === 'true';
    }

    const { count, rows } = await Category.findAndCountAll({
      where,
      order: [['name', 'ASC']],
      limit: parseInt(limit),
      offset: getPaginationSkip(page, limit),
    });

    return {
      categories: rows,
      pagination: formatPagination(page, limit, count),
    };
  }

  /**
   * Get category by ID
   */
  async getCategoryById(tenantId, categoryId) {
    const category = await Category.findOne({
      where: { id: categoryId, tenant_id: tenantId },
    });

    if (!category) {
      throw new NotFoundError('Categoría no encontrada');
    }

    return category;
  }

  /**
   * Update category
   */
  async updateCategory(tenantId, categoryId, categoryData) {
    const category = await Category.findOne({
      where: { id: categoryId, tenant_id: tenantId },
    });

    if (!category) {
      throw new NotFoundError('Categoría no encontrada');
    }

    // Check unique name
    if (categoryData.name && categoryData.name !== category.name) {
      const existingCategory = await Category.findOne({
        where: { tenant_id: tenantId, name: categoryData.name, id: { [Op.ne]: categoryId } },
      });

      if (existingCategory) {
        throw new ValidationError('Ya existe una categoría con este nombre');
      }
    }

    await category.update(categoryData);
    return category;
  }

  /**
   * Delete category
   */
  async deleteCategory(tenantId, categoryId) {
    const category = await Category.findOne({
      where: { id: categoryId, tenant_id: tenantId },
    });

    if (!category) {
      throw new NotFoundError('Categoría no encontrada');
    }

    // Check if category is already inactive
    if (!category.is_active) {
      return { message: 'Categoría ya estaba eliminada' };
    }

    // Check if category has products
    const productCount = await Product.count({
      where: { category_id: categoryId, tenant_id: tenantId },
    });

    if (productCount > 0) {
      throw new ValidationError('No puedes eliminar una categoría con productos asociados');
    }

    await category.update({ is_active: false });
    
    return { message: 'Categoría eliminada correctamente' };
  }
}

module.exports = new CategoryService();
