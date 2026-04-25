import { supabaseServer } from "./supabase";

/**
 * Calculate available stock for a product variant based on recipe logic
 * Stock = minimum batches that can be made from all required ingredients
 * 
 * @param variantId - Product variant ID
 * @param shopId - Shop ID for multi-shop support
 * @returns Available stock count (0 if any ingredient is out of stock)
 */
export async function calculateVariantStock(
  variantId: number,
  shopId: string
): Promise<number> {
  try {
    // Get all ingredients needed for this variant (the recipe)
    const { data: recipeData, error: recipeError } = await supabaseServer
      .from("tbl_product_ingredients")
      .select(`
        ingredient_id,
        amount,
        tbl_ingredients(id, unit)
      `)
      .eq("variant_id", variantId);

    if (recipeError) {
      console.error("Error fetching recipe:", recipeError);
      return 0;
    }

    // If variant has no ingredients, stock is unlimited
    if (!recipeData || recipeData.length === 0) {
      return 999; // Return high number if no ingredients needed
    }

    // Get current inventory for all ingredients in this recipe
    const ingredientIds = (recipeData as any[]).map((r) => r.ingredient_id);

    const { data: inventoryData, error: inventoryError } = await supabaseServer
      .from("tbl_inventory")
      .select("ingredient_id, quantity")
      .in("ingredient_id", ingredientIds);

    if (inventoryError) {
      console.error("Error fetching inventory:", inventoryError);
      return 0;
    }

    // Create inventory map for quick lookup
    const inventoryMap = new Map(
      inventoryData?.map((inv: any) => [inv.ingredient_id, inv.quantity || 0]) || []
    );

    // Calculate how many units can be made from each ingredient
    let minStock = Infinity;

    for (const recipe of recipeData as any[]) {
      const currentStock = inventoryMap.get(recipe.ingredient_id) || 0;
      const amountNeeded = recipe.amount || 1;

      // How many units can be made with this ingredient
      const possibleUnits = Math.floor(currentStock / amountNeeded);

      // Track the minimum (bottleneck ingredient)
      minStock = Math.min(minStock, possibleUnits);

      // If any ingredient is out of stock, product is OUT OF STOCK
      if (possibleUnits < 1) {
        return 0;
      }
    }

    return minStock === Infinity ? 0 : minStock;
  } catch (error) {
    console.error("Error calculating variant stock:", error);
    return 0;
  }
}

/**
 * Calculate stock for all variants of a product
 * @param productId - Product ID
 * @param shopId - Shop ID
 * @returns Array of variants with calculated_stock
 */
export async function calculateProductStock(
  productId: number,
  shopId: string
) {
  try {
    // Get all variants for this product
    const { data: variants, error: variantError } = await supabaseServer
      .from("tbl_product_variants")
      .select("id")
      .eq("product_id", productId);

    if (variantError) {
      console.error("Error fetching variants:", variantError);
      return [];
    }

    if (!variants || variants.length === 0) {
      return [];
    }

    // Calculate stock for each variant in parallel
    const stockPromises = variants.map((v: any) =>
      calculateVariantStock(v.id, shopId)
    );

    const stocks = await Promise.all(stockPromises);

    return variants.map((v: any, idx: number) => ({
      id: v.id,
      calculated_stock: stocks[idx]
    }));
  } catch (error) {
    console.error("Error calculating product stock:", error);
    return [];
  }
}

/**
 * Deduct inventory after order is placed
 * Loop through cart items and reduce ingredient stock by recipe amount
 * 
 * @param cartItems - Array of {variant_id, quantity}
 * @param shopId - Shop ID
 * @returns {success, message, deducted}
 */
export async function deductOrderInventory(
  cartItems: Array<{ variant_id: number; quantity: number }>,
  shopId: string
): Promise<{
  success: boolean;
  message: string;
  deducted?: Array<{ ingredient_id: number; amount: number }>;
}> {
  try {
    // Track all deductions to apply
    const deductionMap = new Map<number, number>();

    // For each cart item, get its recipe and calculate total deductions
    for (const item of cartItems) {
      const { data: recipeData, error: recipeError } = await supabaseServer
        .from("tbl_product_ingredients")
        .select("ingredient_id, amount")
        .eq("variant_id", item.variant_id);

      if (recipeError) {
        return {
          success: false,
          message: `Failed to fetch recipe for variant ${item.variant_id}`
        };
      }

      // Calculate total amount needed for this item (quantity × recipe amount)
      for (const recipe of recipeData || []) {
        const totalNeeded = recipe.amount * item.quantity;
        const current = deductionMap.get(recipe.ingredient_id) || 0;
        deductionMap.set(recipe.ingredient_id, current + totalNeeded);
      }
    }

    // Verify sufficient stock before deducting
    for (const [ingredientId, totalNeeded] of deductionMap.entries()) {
      const { data: invData } = await supabaseServer
        .from("tbl_inventory")
        .select("quantity")
        .eq("ingredient_id", ingredientId)
        .maybeSingle();

      const currentStock = invData?.quantity || 0;

      if (currentStock < totalNeeded) {
        return {
          success: false,
          message: `Insufficient stock for ingredient ID ${ingredientId}. Have ${currentStock}, need ${totalNeeded}`
        };
      }
    }

    // Apply all deductions
    for (const [ingredientId, totalNeeded] of deductionMap.entries()) {
      const { error: updateError } = await supabaseServer
        .from("tbl_inventory")
        .update({
          quantity: supabaseServer
            .rpc("decrement_quantity", {
              ingredient_id: ingredientId,
              decrement_by: totalNeeded
            })
        })
        .eq("ingredient_id", ingredientId);

      // If RPC doesn't work, use direct update
      const { data: currentInv } = await supabaseServer
        .from("tbl_inventory")
        .select("quantity")
        .eq("ingredient_id", ingredientId)
        .maybeSingle();

      const newQuantity = Math.max(0, (currentInv?.quantity || 0) - totalNeeded);

      const { error } = await supabaseServer
        .from("tbl_inventory")
        .update({ quantity: newQuantity })
        .eq("ingredient_id", ingredientId);

      if (error) {
        return {
          success: false,
          message: `Failed to deduct ingredient ${ingredientId}: ${error.message}`
        };
      }
    }

    return {
      success: true,
      message: "Inventory deducted successfully",
      deducted: Array.from(deductionMap, ([ingredientId, amount]) => ({
        ingredient_id: ingredientId,
        amount
      }))
    };
  } catch (error: any) {
    console.error("Error deducting inventory:", error);
    return {
      success: false,
      message: `Inventory deduction failed: ${error.message}`
    };
  }
}

/**
 * Check if a product variant is in stock
 * @param variantId - Variant ID
 * @param shopId - Shop ID
 * @returns true if stock > 0
 */
export async function isVariantInStock(
  variantId: number,
  shopId: string
): Promise<boolean> {
  const stock = await calculateVariantStock(variantId, shopId);
  return stock > 0;
}

/**
 * Get stock details for a variant (for debugging/admin)
 * Shows each ingredient's contribution to final stock
 */
export async function getVariantStockBreakdown(
  variantId: number,
  shopId: string
) {
  try {
    const { data: recipeData } = await supabaseServer
      .from("tbl_product_ingredients")
      .select(`
        ingredient_id,
        amount,
        tbl_ingredients(id, ingredient_name, unit)
      `)
      .eq("variant_id", variantId);

    if (!recipeData || recipeData.length === 0) {
      return { breakdown: [], final_stock: 999 };
    }

    const ingredientIds = (recipeData as any[]).map((r) => r.ingredient_id);
    const { data: inventoryData } = await supabaseServer
      .from("tbl_inventory")
      .select("ingredient_id, quantity")
      .in("ingredient_id", ingredientIds);

    const inventoryMap = new Map(
      inventoryData?.map((inv: any) => [inv.ingredient_id, inv.quantity || 0]) || []
    );

    const breakdown = (recipeData as any[]).map((recipe) => {
      const currentStock = inventoryMap.get(recipe.ingredient_id) || 0;
      const amountNeeded = recipe.amount || 1;
      const possibleUnits = Math.floor(currentStock / amountNeeded);

      return {
        ingredient_id: recipe.ingredient_id,
        ingredient_name: recipe.tbl_ingredients?.ingredient_name,
        unit: recipe.tbl_ingredients?.unit,
        current_stock: currentStock,
        amount_needed_per_unit: amountNeeded,
        possible_units: possibleUnits
      };
    });

    const finalStock = Math.min(...breakdown.map((b) => b.possible_units));

    return {
      breakdown,
      final_stock: finalStock === Infinity ? 0 : finalStock
    };
  } catch (error) {
    console.error("Error getting stock breakdown:", error);
    return { breakdown: [], final_stock: 0 };
  }
}
