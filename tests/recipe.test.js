const db = require('../src/models');
const { Recipe, RecipeItem, Product } = db;
const recipeService = require('../src/services/recipeService');
const { createTenant } = require('./helpers');
const { resetDb } = require('./dbSetup');

// Helper: crea un producto en un tenant
async function makeProduct(tenantId, name, unit = 'kg', stock = 0) {
  return await Product.create({
    tenant_id: tenantId, name, unit, type: 'unit',
    price: 10000, cost: 5000, stock, min_stock: 1,
  });
}

// Helper: crea un tenant con un pollo (origen) y dos cortes (destinos)
async function seedRecipeProducts(label) {
  const t = await createTenant(label);
  const pollo = await makeProduct(t.tenant.id, 'Pollo', 'und', 35);
  const pechuga = await makeProduct(t.tenant.id, 'Pechuga', 'kg', 0);
  const alas = await makeProduct(t.tenant.id, 'Alas', 'kg', 0);
  return { ...t, pollo, pechuga, alas };
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await db.sequelize.close();
});

describe('CRUD de recetas de despiece', () => {
  test('crea una receta con su cabecera e items', async () => {
    const { tenant, pollo, pechuga, alas } = await seedRecipeProducts('A');

    const recipe = await recipeService.createRecipe(tenant.id, {
      name: 'Despiece de pollo',
      source_product_id: pollo.id,
      items: [
        { product_id: pechuga.id, quantity: 0.8 },
        { product_id: alas.id, quantity: 0.3 },
      ],
    });

    expect(recipe.id).toBeDefined();
    expect(recipe.name).toBe('Despiece de pollo');

    // Verifica que los items se crearon en la BD
    const items = await RecipeItem.findAll({ where: { recipe_id: recipe.id } });
    expect(items).toHaveLength(2);
  });

  test('getRecipeById trae la receta completa (origen + items + productos)', async () => {
    const { tenant, pollo, pechuga, alas } = await seedRecipeProducts('A');
    const created = await recipeService.createRecipe(tenant.id, {
      name: 'Despiece de pollo',
      source_product_id: pollo.id,
      items: [
        { product_id: pechuga.id, quantity: 0.8 },
        { product_id: alas.id, quantity: 0.3 },
      ],
    });

    const recipe = await recipeService.getRecipeById(tenant.id, created.id);

    expect(recipe.sourceProduct.name).toBe('Pollo');
    expect(recipe.items).toHaveLength(2);
    // Cada item trae su producto asociado
    const nombres = recipe.items.map((i) => i.product.name).sort();
    expect(nombres).toEqual(['Alas', 'Pechuga']);
  });

  test('rechaza crear receta sin items', async () => {
    const { tenant, pollo } = await seedRecipeProducts('A');

    await expect(
      recipeService.createRecipe(tenant.id, {
        name: 'Vacía',
        source_product_id: pollo.id,
        items: [],
      })
    ).rejects.toThrow(/al menos un destino/i);
  });

  test('rechaza si el origen es también un destino', async () => {
    const { tenant, pollo } = await seedRecipeProducts('A');

    await expect(
      recipeService.createRecipe(tenant.id, {
        name: 'Incoherente',
        source_product_id: pollo.id,
        items: [{ product_id: pollo.id, quantity: 1 }],
      })
    ).rejects.toThrow(/no puede ser también un destino/i);
  });

  test('actualizar reemplaza los items', async () => {
    const { tenant, pollo, pechuga, alas } = await seedRecipeProducts('A');
    const created = await recipeService.createRecipe(tenant.id, {
      name: 'Despiece de pollo',
      source_product_id: pollo.id,
      items: [{ product_id: pechuga.id, quantity: 0.8 }],
    });

    // Actualiza con items distintos (ahora 2 en vez de 1)
    await recipeService.updateRecipe(tenant.id, created.id, {
      name: 'Despiece actualizado',
      items: [
        { product_id: pechuga.id, quantity: 0.9 },
        { product_id: alas.id, quantity: 0.4 },
      ],
    });

    const recipe = await recipeService.getRecipeById(tenant.id, created.id);
    expect(recipe.name).toBe('Despiece actualizado');
    expect(recipe.items).toHaveLength(2); // reemplazó (no acumuló)
  });

  test('borrar una receta elimina también sus items (cascade)', async () => {
    const { tenant, pollo, pechuga } = await seedRecipeProducts('A');
    const created = await recipeService.createRecipe(tenant.id, {
      name: 'A borrar',
      source_product_id: pollo.id,
      items: [{ product_id: pechuga.id, quantity: 0.8 }],
    });

    await recipeService.deleteRecipe(tenant.id, created.id);

    // La receta ya no existe
    await expect(
      recipeService.getRecipeById(tenant.id, created.id)
    ).rejects.toThrow(/no encontrada/i);

    // Y sus items tampoco (cascade)
    const items = await RecipeItem.findAll({ where: { recipe_id: created.id } });
    expect(items).toHaveLength(0);
  });

  test('aislamiento: un tenant no puede ver la receta de otro', async () => {
    const a = await seedRecipeProducts('A');
    const b = await seedRecipeProducts('B');

    const recipeB = await recipeService.createRecipe(b.tenant.id, {
      name: 'Receta de B',
      source_product_id: b.pollo.id,
      items: [{ product_id: b.pechuga.id, quantity: 0.5 }],
    });

    // Tenant A intenta ver la receta de B → no encontrada
    await expect(
      recipeService.getRecipeById(a.tenant.id, recipeB.id)
    ).rejects.toThrow(/no encontrada/i);
  });
});