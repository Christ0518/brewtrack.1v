import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { sumDecimalStrings } from "@/lib/decimal";

async function resolveProductImage(image: unknown): Promise<string | null> {
  if (typeof image !== "string" || !image.trim()) return null;

  if (!image.startsWith("data:image/")) {
    return image;
  }

  const match = image.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;

  const extension = match[1] === "jpeg" ? "jpg" : match[1];
  const base64Data = match[2];
  const fileName = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const fileBuffer = Buffer.from(base64Data, "base64");

  const { error } = await supabaseServer.storage
    .from("product-images")
    .upload(fileName, fileBuffer, {
      contentType: `image/${match[1]}`,
      upsert: false,
    });

  if (error) {
    throw error;
  }

  const { data } = supabaseServer.storage.from("product-images").getPublicUrl(fileName);
  return data.publicUrl;
}

/* =========================
   HELPERS
========================= */
function getShopId(req: NextRequest): string | null {
  // Adjust this to however you pass shop_id (header, cookie, query, etc.)
  return (
    req.headers.get("x-shop-id") ||
    new URL(req.url).searchParams.get("shop_id") ||
    null
  );
}

function validateRecipeVariants(variants: unknown): string | null {
  if (!Array.isArray(variants)) return "Variants must be an array";

  for (const variant of variants) {
    if (!variant || typeof variant !== "object") return "Each variant must be an object";

    if (variant.ingredients !== undefined && !Array.isArray(variant.ingredients)) {
      return "Variant ingredients must be an array";
    }

    for (const ingredient of variant.ingredients ?? []) {
      const ingredientId = Number(ingredient?.ingredient_id);
      const amount = Number(ingredient?.amount);
      if (!Number.isInteger(ingredientId) || ingredientId <= 0) {
        return "Each recipe ingredient must have a valid ingredient ID";
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        return "Each recipe ingredient must have an amount greater than zero";
      }
    }
  }

  return null;
}

function getRecipeInsertErrorMessage(error: { code?: string; details?: string | null; message: string }) {
  if (
    error.code === "23502" &&
    error.message.includes('column "id" of relation "tbl_product_ingredients"')
  ) {
    return "The database is missing the product recipe ID generator. Run migrations/013_generate_product_ingredient_ids.sql in Supabase SQL Editor, then save the product again.";
  }

  return error.message;
}

/**
 * Takes flat variant+ingredient rows and groups them into:
 * [{ id, name, price, calculated_cost, quantity, ingredients: [...] }]
 * quantity is calculated from ingredient availability (same logic as MySQL version)
 */
function groupVariantsWithQuantity(rows: any[]) {
  const variantsMap = new Map<number, any>();

  for (const row of rows) {
    if (!row.variant_id) continue;

    if (!variantsMap.has(row.variant_id)) {
      variantsMap.set(row.variant_id, {
        id:              row.variant_id,
        name:            row.variant_name,
        price:           row.price,
        calculated_cost: row.calculated_cost ?? 0,
        quantity:        0,
        ingredients:     [],
      });
    }

    if (row.ingredient_id) {
      variantsMap.get(row.variant_id)!.ingredients.push({
        id:            row.ingredient_id,
        ingredient_id: row.ingredient_id,
        name:          row.ingredient_name,
        unit:          row.unit,
        amount:        row.required_amount,       // how much this variant needs
        available:     Number(row.available_quantity) || 0, // stock on hand
        quantity:      Number(row.available_quantity) || 0,
      });
    }
  }

  // ── Calculate makeable quantity per variant ──────────────────────────────
  for (const variant of variantsMap.values()) {
    if (variant.ingredients.length === 0) {
      variant.quantity = 0;
    } else {
      const possibleUnits = variant.ingredients.map((ing: any) => {
        if (!ing.amount || ing.amount === 0) return Infinity;
        return Math.floor(ing.available / ing.amount);
      });
      const min = Math.min(...possibleUnits);
      variant.quantity = min === Infinity || min < 0 ? 0 : min;
    }
  }

  return Array.from(variantsMap.values());
}

/* =========================
   SHARED QUERY
   Mirrors the big LEFT JOIN in getProductById / getProductsFull
========================= */
async function fetchProductRows(filters: {
  shopId: string;
  productId?: string;
}) {
  let query = supabaseServer
    .from("tbl_products")
    .select(
      "id, product_name, product_description, image, category_id, shop_id, is_deleted, created_at"
    )
    .eq("is_deleted", false)
    .eq("shop_id", filters.shopId)
    .order("id", { ascending: false });

  if (filters.productId) {
    query = query.eq("id", filters.productId);
  }

  const { data: productRows, error: productError } = await query;
  if (productError) return { data: null, error: productError };

  const products = productRows ?? [];
  if (products.length === 0) return { data: [], error: null };

  const productIds = products.map((product: any) => product.id);
  const { data: variants, error: variantsError } = await supabaseServer
    .from("tbl_product_variants")
    .select("id, product_id, name, price, calculated_cost")
    .in("product_id", productIds);
  if (variantsError) return { data: null, error: variantsError };

  const variantRows = variants ?? [];
  const variantIds = variantRows.map((variant: any) => variant.id);
  const { data: recipeRows, error: recipeError } = variantIds.length
    ? await supabaseServer
        .from("tbl_product_ingredients")
        .select("variant_id, ingredient_id, amount")
        .in("variant_id", variantIds)
    : { data: [] as any[], error: null };
  if (recipeError) return { data: null, error: recipeError };

  const ingredientIds = Array.from(
    new Set((recipeRows ?? []).map((recipe: any) => Number(recipe.ingredient_id)))
  ).filter((id) => Number.isFinite(id));
  const { data: ingredients, error: ingredientsError } = ingredientIds.length
    ? await supabaseServer
        .from("tbl_ingredients")
        .select("id, ingredient_name, unit")
        .in("id", ingredientIds)
    : { data: [] as any[], error: null };
  if (ingredientsError) return { data: null, error: ingredientsError };

  const ingredientById = new Map(
    (ingredients ?? []).map((ingredient: any) => [Number(ingredient.id), ingredient])
  );
  const recipesByVariant = new Map<number, any[]>();
  for (const recipe of recipeRows ?? []) {
    const linkedIngredient = ingredientById.get(Number(recipe.ingredient_id));
    const variantRecipes = recipesByVariant.get(Number(recipe.variant_id)) ?? [];
    variantRecipes.push({
      amount: recipe.amount,
      tbl_ingredients: linkedIngredient ?? null,
    });
    recipesByVariant.set(Number(recipe.variant_id), variantRecipes);
  }

  const variantsByProduct = new Map<number, any[]>();
  for (const variant of variantRows) {
    const productVariants = variantsByProduct.get(Number(variant.product_id)) ?? [];
    productVariants.push({
      ...variant,
      tbl_product_ingredients: recipesByVariant.get(Number(variant.id)) ?? [],
    });
    variantsByProduct.set(Number(variant.product_id), productVariants);
  }

  return {
    data: products.map((product: any) => ({
      ...product,
      tbl_product_variants: variantsByProduct.get(Number(product.id)) ?? [],
    })),
    error: null,
  };
}

/**
 * Supabase returns nested objects instead of flat JOIN rows.
 * This normalises the nested shape into the same structure
 * that groupVariantsWithQuantity() expects.
 */
function normaliseProduct(p: any, inventoryMap: Map<number, number>) {
  const variants = (p.tbl_product_variants ?? []).map((v: any) => {
    const ingredients = (v.tbl_product_ingredients ?? []).map((pi: any) => {
      const ing = pi.tbl_ingredients;
      const ingredientId = Number(ing?.id);
      return {
        ingredient_id:      ingredientId,
        ingredient_name:    ing?.ingredient_name,
        unit:               ing?.unit,
        required_amount:    pi.amount,
        available_quantity: inventoryMap.get(ingredientId) ?? 0,
      };
    });

    // Flatten into rows so groupVariantsWithQuantity can handle it
    return ingredients.length > 0
      ? ingredients.map((ing: any) => ({
          variant_id:         v.id,
          variant_name:       v.name,
          price:              v.price,
          calculated_cost:    v.calculated_cost,
          ...ing,
        }))
      : [
          {
            variant_id:      v.id,
            variant_name:    v.name,
            price:           v.price,
            calculated_cost: v.calculated_cost,
            ingredient_id:   null,
          },
        ];
  });

  return {
    id:                  p.id,
    product_name:        p.product_name,
    product_description: p.product_description,
    image:               p.image,
    category_id:         p.category_id,
    shop_id:             p.shop_id,
    is_deleted:          p.is_deleted,
    created_at:          p.created_at,
    category:            null,
    variants:            groupVariantsWithQuantity(variants.flat()),
  };
}

async function fetchInventoryMap(ingredientIds: number[]) {
  const inventoryMap = new Map<number, number>();
  if (ingredientIds.length === 0) return { inventoryMap, error: null };

  const { data: inventoryData, error: inventoryError } = await supabaseServer
    .from("tbl_inventory")
    .select("ingredient_id, quantity")
    .in("ingredient_id", ingredientIds);
  if (inventoryError) return { inventoryMap, error: inventoryError };

  const ingredientsNeedingBatchFallback = new Set(ingredientIds);
  for (const inventory of inventoryData ?? []) {
    const ingredientId = Number(inventory.ingredient_id);
    const quantity = Number(inventory.quantity);
    if (!Number.isFinite(quantity)) continue;

    inventoryMap.set(ingredientId, quantity);
    if (quantity > 0) ingredientsNeedingBatchFallback.delete(ingredientId);
  }

  if (ingredientsNeedingBatchFallback.size === 0) return { inventoryMap, error: null };

  const { data: batchData, error: batchError } = await supabaseServer
    .from("ingredient_batches")
    .select("ingredient_id, quantity, remaining_quantity")
    .in("ingredient_id", Array.from(ingredientsNeedingBatchFallback));
  if (batchError) return { inventoryMap, error: batchError };

  const batchesByIngredient = new Map<number, any[]>();
  for (const batch of batchData ?? []) {
    const ingredientId = Number(batch.ingredient_id);
    const batches = batchesByIngredient.get(ingredientId) ?? [];
    batches.push(batch.remaining_quantity ?? batch.quantity);
    batchesByIngredient.set(ingredientId, batches);
  }

  for (const ingredientId of ingredientsNeedingBatchFallback) {
    const batches = batchesByIngredient.get(ingredientId);
    if (batches?.length) {
      inventoryMap.set(ingredientId, Number(sumDecimalStrings(batches)));
    } else if (!inventoryMap.has(ingredientId)) {
      inventoryMap.set(ingredientId, 0);
    }
  }

  return { inventoryMap, error: null };
}

/* =========================
   GET  /api/products
   ?shop_id=xxx            → all products for shop (with variants + quantity)
   ?shop_id=xxx&id=yyy     → single product
========================= */
export async function GET(req: NextRequest) {
  try {
    const url      = new URL(req.url);
    const shopId   = getShopId(req);
    const productId = url.searchParams.get("id") ?? undefined;

    if (!shopId) {
      return NextResponse.json({ success: false, message: "shop_id is required" }, { status: 400 });
    }

    const { data, error } = await fetchProductRows({ shopId, productId });

    if (error) {
      console.error("[GET /products]", error);
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    const ingredientIds = Array.from(
      new Set(
        (data ?? []).flatMap((p: any) =>
          (p.tbl_product_variants ?? []).flatMap((v: any) =>
            (v.tbl_product_ingredients ?? [])
              .map((pi: any) => Number(pi.tbl_ingredients?.id))
              .filter((id: number) => !Number.isNaN(id))
          )
        )
      )
    );

    const { inventoryMap, error: inventoryError } = await fetchInventoryMap(ingredientIds);
    if (inventoryError) {
      console.error("[GET /products] inventory lookup failed:", inventoryError);
      return NextResponse.json(
        { success: false, message: "Cannot get ingredient inventory", error: inventoryError.message },
        { status: 500 }
      );
    }

    const products = (data ?? []).map((p: any) => normaliseProduct(p, inventoryMap));

    // Single product → mirror getProductById response shape
    if (productId) {
      if (products.length === 0) {
        return NextResponse.json({ success: false, message: "Product not found" }, { status: 404 });
      }
      const { variants, ...product } = products[0];
      return NextResponse.json({ success: true, product, variants });
    }

    // All products → mirror getAllProducts response shape
    return NextResponse.json({ success: true, products });
  } catch (err: any) {
    console.error("[GET /products] unexpected:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

/* =========================
   POST  /api/products
   Body: { shop_id, category_id, product_name, product_description?, image?, variants? }
   variants: [{ name, price, calculated_cost, ingredients: [{ ingredient_id, amount }] }]
========================= */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      shop_id,
      category_id,
      product_name,
      product_description = "",
      image = null,
      variants = [],
    } = body;

    if (!shop_id || !category_id || !product_name) {
      return NextResponse.json(
        { success: false, message: "shop_id, category_id, and product_name are required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(variants)) {
      return NextResponse.json({ success: false, message: "Variants must be an array" }, { status: 400 });
    }
    const variantsArray = variants;
    const recipeValidationError = validateRecipeVariants(variantsArray);
    if (recipeValidationError) {
      return NextResponse.json({ success: false, message: recipeValidationError }, { status: 400 });
    }

    const resolvedImage = await resolveProductImage(image);

    // ── 1. Insert product ────────────────────────────────────────────────
    const { data: product, error: productError } = await supabaseServer
      .from("tbl_products")
      .insert([{ shop_id, category_id, product_name, product_description, image: resolvedImage }])
      .select()
      .single();

    if (productError) {
      console.error("[POST /products] insert product:", productError);
      return NextResponse.json({ success: false, message: productError.message }, { status: 500 });
    }

    // ── 2. Insert variants + ingredients ─────────────────────────────────
    for (const v of variantsArray) {
      const variant_name     = v.variant_name || v.name || null;
      const price            = v.price !== undefined && v.price !== "" ? Number(v.price) : null;
      const calculated_cost  = v.calculated_cost !== undefined ? Number(v.calculated_cost) : 0;

      const { data: variant, error: variantError } = await supabaseServer
        .from("tbl_product_variants")
        .insert([{ product_id: product.id, name: variant_name, price, calculated_cost }])
        .select()
        .single();

      if (variantError) {
        console.error("[POST /products] insert variant:", variantError);
        return NextResponse.json({ success: false, message: variantError.message }, { status: 500 });
      }

      if (v.ingredients?.length > 0) {
        const ingredientRows = v.ingredients
          .filter((i: any) => i.ingredient_id && i.amount !== undefined && i.amount !== "")
          .map((i: any) => ({
            variant_id:    variant.id,
            ingredient_id: i.ingredient_id,
            amount:        Number(i.amount),
          }));

        if (ingredientRows.length > 0) {
          const { error: ingError } = await supabaseServer
            .from("tbl_product_ingredients")
            .insert(ingredientRows);

          if (ingError) {
            console.error("[POST /products] insert ingredients:", ingError);
            return NextResponse.json({
              success: false,
              message: getRecipeInsertErrorMessage(ingError),
              error: ingError.message,
            }, { status: 500 });
          }
        }
      }
    }

    // ── 3. Return full product with variants ─────────────────────────────
    const { data: full, error: fetchError } = await fetchProductRows({
      shopId:    String(shop_id),
      productId: String(product.id),
    });

    if (fetchError || !full?.length) {
      // Still return the bare product if re-fetch fails
      return NextResponse.json({ success: true, product }, { status: 201 });
    }

    const postIngredientIds = Array.from(
      new Set(
        (full ?? []).flatMap((p: any) =>
          (p.tbl_product_variants ?? []).flatMap((v: any) =>
            (v.tbl_product_ingredients ?? [])
              .map((pi: any) => Number(pi.tbl_ingredients?.id))
              .filter((id: number) => !Number.isNaN(id))
          )
        )
      )
    );

    const { data: postInventoryData } = postIngredientIds.length
      ? await supabaseServer
          .from("tbl_inventory")
          .select("ingredient_id, quantity")
          .in("ingredient_id", postIngredientIds)
      : { data: [] as any[] };

    const postInventoryMap = new Map<number, number>(
      (postInventoryData ?? []).map((inv: any) => [Number(inv.ingredient_id), Number(inv.quantity) || 0])
    );

    return NextResponse.json(
      { success: true, ...normaliseProduct(full[0], postInventoryMap) },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[POST /products] unexpected:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

/* =========================
   PUT  /api/products
   Body: { id, category_id?, product_name?, product_description?, image?, variants? }
========================= */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, category_id, product_name, product_description, image, variants } = body;
    const shopId = getShopId(req) || body.shop_id;

    if (!id)     return NextResponse.json({ success: false, message: "id is required" }, { status: 400 });
    if (!shopId) return NextResponse.json({ success: false, message: "shop_id is required" }, { status: 400 });
    if (variants !== undefined) {
      const recipeValidationError = validateRecipeVariants(variants);
      if (recipeValidationError) {
        return NextResponse.json({ success: false, message: recipeValidationError }, { status: 400 });
      }
    }

    // ── 1. Update product fields ─────────────────────────────────────────
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (category_id         !== undefined) updates.category_id         = category_id;
    if (product_name        !== undefined) updates.product_name        = product_name;
    if (product_description !== undefined) updates.product_description = product_description;
    if (image               !== undefined) updates.image               = image;

    if (image !== undefined) {
      updates.image = await resolveProductImage(image);
    }

    const { error: updateError } = await supabaseServer
      .from("tbl_products")
      .update(updates)
      .eq("id", id)
      .eq("shop_id", shopId)
      .eq("is_deleted", false);

    if (updateError) {
      console.error("[PUT /products] update product:", updateError);
      if (updateError.code === "PGRST116") {
        return NextResponse.json({ success: false, message: "Product not found" }, { status: 404 });
      }
      return NextResponse.json({ success: false, message: updateError.message }, { status: 500 });
    }

    // ── 2. Handle variants (mirrors MySQL updateProduct logic) ───────────
    if (variants !== undefined) {
      const variantsArray: any[] = Array.isArray(variants) ? variants : [];

      // IDs we want to keep
      const keepIds = variantsArray.filter((v) => v.id).map((v) => v.id);

      // Delete variants no longer in the list
      if (keepIds.length > 0) {
        const { error: deleteVariantsError } = await supabaseServer
          .from("tbl_product_variants")
          .delete()
          .eq("product_id", id)
          .not("id", "in", `(${keepIds.join(",")})`);
        if (deleteVariantsError) {
          console.error("[PUT /products] delete removed variants:", deleteVariantsError);
          return NextResponse.json({ success: false, message: deleteVariantsError.message }, { status: 500 });
        }
      } else {
        // No existing variants sent → delete all old ones
        const { error: deleteVariantsError } = await supabaseServer
          .from("tbl_product_variants")
          .delete()
          .eq("product_id", id);
        if (deleteVariantsError) {
          console.error("[PUT /products] delete variants:", deleteVariantsError);
          return NextResponse.json({ success: false, message: deleteVariantsError.message }, { status: 500 });
        }
      }

      for (const v of variantsArray) {
        const variant_name    = v.variant_name || v.name || null;
        const price           = v.price !== undefined && v.price !== "" ? Number(v.price) : null;
        const calculated_cost = v.calculated_cost !== undefined ? Number(v.calculated_cost) : 0;

        let variant_id: number;

        if (v.id) {
          // Update existing variant
          const { error: updateVariantError } = await supabaseServer
            .from("tbl_product_variants")
            .update({ name: variant_name, price, calculated_cost })
            .eq("id", v.id);
          if (updateVariantError) {
            console.error("[PUT /products] update variant:", updateVariantError);
            return NextResponse.json({ success: false, message: updateVariantError.message }, { status: 500 });
          }
          variant_id = v.id;
        } else {
          // Insert new variant
          const { data: newVariant, error: vErr } = await supabaseServer
            .from("tbl_product_variants")
            .insert([{ product_id: id, name: variant_name, price, calculated_cost }])
            .select()
            .single();

          if (vErr || !newVariant) {
            console.error("[PUT /products] insert variant:", vErr);
            return NextResponse.json(
              { success: false, message: vErr?.message || "Cannot create product variant" },
              { status: 500 }
            );
          }
          variant_id = newVariant.id;
        }

        // Delete old ingredients for this variant, then re-insert
        const { error: deleteIngredientsError } = await supabaseServer
          .from("tbl_product_ingredients")
          .delete()
          .eq("variant_id", variant_id);
        if (deleteIngredientsError) {
          console.error("[PUT /products] delete recipe ingredients:", deleteIngredientsError);
          return NextResponse.json({ success: false, message: deleteIngredientsError.message }, { status: 500 });
        }

        if (v.ingredients?.length > 0) {
          const ingredientRows = v.ingredients
            .filter((i: any) => i.ingredient_id && i.amount !== undefined && i.amount !== "")
            .map((i: any) => ({
              variant_id,
              ingredient_id: i.ingredient_id,
              amount:        Number(i.amount),
            }));

          if (ingredientRows.length > 0) {
            const { error: ingErr } = await supabaseServer
              .from("tbl_product_ingredients")
              .insert(ingredientRows);

            if (ingErr) {
              console.error("[PUT /products] insert ingredients:", ingErr);
              return NextResponse.json({
                success: false,
                message: getRecipeInsertErrorMessage(ingErr),
                error: ingErr.message,
              }, { status: 500 });
            }
          }
        }
      }
    }

    // ── 3. Return updated product ────────────────────────────────────────
    const { data: full, error: fetchError } = await fetchProductRows({
      shopId,
      productId: String(id),
    });

    if (fetchError || !full?.length) {
      return NextResponse.json({ success: true, message: "Product updated" });
    }

    const putIngredientIds = Array.from(
      new Set(
        (full ?? []).flatMap((p: any) =>
          (p.tbl_product_variants ?? []).flatMap((v: any) =>
            (v.tbl_product_ingredients ?? [])
              .map((pi: any) => Number(pi.tbl_ingredients?.id))
              .filter((id: number) => !Number.isNaN(id))
          )
        )
      )
    );

    const { inventoryMap: putInventoryMap, error: putInventoryError } =
      await fetchInventoryMap(putIngredientIds);
    if (putInventoryError) {
      console.error("[PUT /products] inventory lookup failed:", putInventoryError);
      return NextResponse.json(
        { success: false, message: "Cannot get ingredient inventory", error: putInventoryError.message },
        { status: 500 }
      );
    }

    const { variants: updatedVariants, ...updatedProduct } = normaliseProduct(full[0], putInventoryMap);

    return NextResponse.json({
      success:  true,
      message:  "Product updated successfully",
      product:  updatedProduct,
      variants: updatedVariants,
    });
  } catch (err: any) {
    console.error("[PUT /products] unexpected:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

/* =========================
   DELETE  /api/products
   Soft-delete. Accepts ?id=xxx OR body { id }
========================= */
export async function DELETE(req: NextRequest) {
  try {
    const url    = new URL(req.url);
    let bodyShopId: string | null = null;
    let   id     = url.searchParams.get("id");

    if (!id) {
      try {
        const body = await req.json();
        id = body?.id ?? null;
        bodyShopId = body?.shop_id ?? null;
      } catch { /* not JSON */ }
    }

    const shopId = getShopId(req) || bodyShopId;

    if (!id)     return NextResponse.json({ success: false, message: "id is required" }, { status: 400 });
    if (!shopId) return NextResponse.json({ success: false, message: "shop_id is required" }, { status: 400 });

    const { data, error } = await supabaseServer
      .from("tbl_products")
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("shop_id", shopId)
      .eq("is_deleted", false)
      .select()
      .single();

    if (error) {
      console.error("[DELETE /products]", error);
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { success: false, message: "Product not found or already deleted" },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Product deleted", data });
  } catch (err: any) {
    console.error("[DELETE /products] unexpected:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}