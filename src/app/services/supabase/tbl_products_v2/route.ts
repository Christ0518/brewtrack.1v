import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { calculateVariantStock, deductOrderInventory } from "@/lib/stock";

/**
 * GET - Get all products or single product with calculated stock
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const shopId = url.searchParams.get("shop_id");
    const id = url.searchParams.get("id");

    if (!shopId || isNaN(Number(shopId))) {
      return NextResponse.json(
        { message: "Invalid shop ID" },
        { status: 400 }
      );
    }

    // Single product
    if (id) {
      if (isNaN(Number(id))) {
        return NextResponse.json(
          { message: "Invalid product ID" },
          { status: 400 }
        );
      }

      const { data: product, error: productError } = await supabaseServer
        .from("tbl_products")
        .select(`
          id,
          product_name,
          product_description,
          category_id,
          shop_id,
          is_deleted
        `)
        .eq("id", id)
        .eq("shop_id", shopId)
        .eq("is_deleted", 0)
        .maybeSingle();

      if (productError) {
        console.error("Error fetching product:", productError);
        return NextResponse.json(
          { message: "Cannot get product", error: productError.message },
          { status: 500 }
        );
      }

      if (!product) {
        return NextResponse.json(
          { message: "Product not found" },
          { status: 404 }
        );
      }

      // Get variants with calculated stock
      const { data: variants, error: variantError } = await supabaseServer
        .from("tbl_product_variants")
        .select(`
          id,
          name,
          price,
          quantity,
          calculated_cost
        `)
        .eq("product_id", id)
        .eq("is_deleted", 0);

      if (variantError) {
        console.error("Error fetching variants:", variantError);
        return NextResponse.json(
          { message: "Cannot get variants", error: variantError.message },
          { status: 500 }
        );
      }

      // Calculate stock for each variant
      const variantsWithStock = await Promise.all(
        (variants || []).map(async (v) => ({
          ...v,
          calculated_stock: await calculateVariantStock(v.id, shopId)
        }))
      );

      return NextResponse.json(
        {
          ...product,
          variants: variantsWithStock
        },
        { status: 200 }
      );
    }

    // All products for shop
    const { data: products, error: productsError } = await supabaseServer
      .from("tbl_products")
      .select(`
        id,
        product_name,
        product_description,
        category_id,
        shop_id,
        is_deleted
      `)
      .eq("shop_id", shopId)
      .eq("is_deleted", 0)
      .order("id", { ascending: false });

    if (productsError) {
      console.error("Error fetching products:", productsError);
      return NextResponse.json(
        { message: "Cannot get products", error: productsError.message },
        { status: 500 }
      );
    }

    // Get variants for all products
    const { data: allVariants, error: variantsError } = await supabaseServer
      .from("tbl_product_variants")
      .select(`
        id,
        product_id,
        name,
        price,
        quantity,
        calculated_cost,
        is_deleted
      `)
      .eq("is_deleted", 0);

    if (variantsError) {
      console.error("Error fetching variants:", variantsError);
      return NextResponse.json(
        { message: "Cannot get variants", error: variantsError.message },
        { status: 500 }
      );
    }

    // Map variants to products
    const variantsByProduct = new Map(
      products?.map((p) => [p.id, []])
    );

    for (const variant of allVariants || []) {
      if (variantsByProduct.has(variant.product_id)) {
        variantsByProduct.get(variant.product_id)!.push(variant);
      }
    }

    // Calculate stock for all variants in parallel
    const productsWithStock = await Promise.all(
      (products || []).map(async (product) => {
        const variants = variantsByProduct.get(product.id) || [];
        const variantsWithStock = await Promise.all(
          variants.map(async (v) => ({
            ...v,
            calculated_stock: await calculateVariantStock(v.id, shopId)
          }))
        );

        return {
          ...product,
          variants: variantsWithStock
        };
      })
    );

    return NextResponse.json(productsWithStock, { status: 200 });
  } catch (error) {
    console.error("Error in GET handler:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST - Add product with variants
 */
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const shopId = url.searchParams.get("shop_id");

    if (!shopId || isNaN(Number(shopId))) {
      return NextResponse.json(
        { message: "Invalid shop ID" },
        { status: 400 }
      );
    }

    const {
      category_id,
      product_name,
      product_description,
      variants
    } = await req.json();

    if (!category_id || !product_name) {
      return NextResponse.json(
        { message: "Missing required fields (category_id, product_name)" },
        { status: 400 }
      );
    }

    // Insert product
    const { data: productData, error: productError } = await supabaseServer
      .from("tbl_products")
      .insert([{
        category_id: Number(category_id),
        product_name,
        product_description: product_description || "",
        shop_id: Number(shopId),
        is_deleted: 0
      }])
      .select("id");

    if (productError) {
      console.error("Error adding product:", productError);
      return NextResponse.json(
        { message: "Cannot add product", error: productError.message },
        { status: 500 }
      );
    }

    const productId = productData[0].id;

    // Insert variants if provided
    if (variants && Array.isArray(variants) && variants.length > 0) {
      const variantRecords = variants.map((v: any) => ({
        product_id: productId,
        name: v.name || "",
        price: parseFloat(v.price) || 0,
        quantity: 0, // DEPRECATED - stock now calculated from inventory
        calculated_cost: parseFloat(v.calculated_cost) || 0,
        is_deleted: 0
      }));

      const { data: variantData, error: variantError } = await supabaseServer
        .from("tbl_product_variants")
        .insert(variantRecords)
        .select("id");

      if (variantError) {
        console.error("Error adding variants:", variantError);
        return NextResponse.json(
          { message: "Cannot add variants", error: variantError.message },
          { status: 500 }
        );
      }

      // Insert product ingredients (recipe) if provided
      for (let i = 0; i < variants.length; i++) {
        const variant = variants[i];
        const variantId = variantData[i].id;

        if (variant.ingredients && Array.isArray(variant.ingredients)) {
          const ingredientRecords = variant.ingredients.map((ing: any) => ({
            variant_id: variantId,
            ingredient_id: ing.ingredient_id,
            amount: ing.amount || 1
          }));

          const { error: ingredientError } = await supabaseServer
            .from("tbl_product_ingredients")
            .insert(ingredientRecords);

          if (ingredientError) {
            console.error("Error adding ingredients:", ingredientError);
            // Continue - ingredient linking is secondary
          }
        }
      }
    }

    return NextResponse.json(
      {
        message: "Product added successfully",
        id: productId
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error in POST handler:", error);
    return NextResponse.json(
      { message: "Error saving product", error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update product and variants
 */
export async function PUT(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const shopId = url.searchParams.get("shop_id");

    if (!shopId || isNaN(Number(shopId))) {
      return NextResponse.json(
        { message: "Invalid shop ID" },
        { status: 400 }
      );
    }

    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { message: "Invalid product ID" },
        { status: 400 }
      );
    }

    const {
      category_id,
      product_name,
      product_description,
      variants
    } = await req.json();

    // Update product
    const updateData: any = {};
    if (category_id !== undefined) updateData.category_id = Number(category_id);
    if (product_name !== undefined) updateData.product_name = product_name;
    if (product_description !== undefined) updateData.product_description = product_description;

    const { error: updateError } = await supabaseServer
      .from("tbl_products")
      .update(updateData)
      .eq("id", id)
      .eq("shop_id", shopId)
      .eq("is_deleted", 0);

    if (updateError) {
      console.error("Error updating product:", updateError);
      return NextResponse.json(
        { message: "Cannot update product", error: updateError.message },
        { status: 500 }
      );
    }

    // Update variants if provided
    if (variants && Array.isArray(variants)) {
      for (const variant of variants) {
        if (!variant.id) continue;

        const variantUpdate: any = {};
        if (variant.name !== undefined) variantUpdate.name = variant.name;
        if (variant.price !== undefined) variantUpdate.price = parseFloat(variant.price);
        if (variant.calculated_cost !== undefined) variantUpdate.calculated_cost = parseFloat(variant.calculated_cost);

        const { error: variantError } = await supabaseServer
          .from("tbl_product_variants")
          .update(variantUpdate)
          .eq("id", variant.id);

        if (variantError) {
          console.error("Error updating variant:", variantError);
        }

        // Update ingredients if provided
        if (variant.ingredients && Array.isArray(variant.ingredients)) {
          // Delete old ingredients
          await supabaseServer
            .from("tbl_product_ingredients")
            .delete()
            .eq("variant_id", variant.id);

          // Insert new ingredients
          const ingredientRecords = variant.ingredients.map((ing: any) => ({
            variant_id: variant.id,
            ingredient_id: ing.ingredient_id,
            amount: ing.amount || 1
          }));

          await supabaseServer
            .from("tbl_product_ingredients")
            .insert(ingredientRecords);
        }
      }
    }

    return NextResponse.json(
      { message: "Product updated" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error in PUT handler:", error);
    return NextResponse.json(
      { message: "Cannot update product", error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Soft delete product
 */
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const shopId = url.searchParams.get("shop_id");

    if (!shopId || isNaN(Number(shopId))) {
      return NextResponse.json(
        { message: "Invalid shop ID" },
        { status: 400 }
      );
    }

    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { message: "Invalid product ID" },
        { status: 400 }
      );
    }

    const { error } = await supabaseServer
      .from("tbl_products")
      .update({ is_deleted: 1 })
      .eq("id", id)
      .eq("shop_id", shopId);

    if (error) {
      console.error("Error deleting product:", error);
      return NextResponse.json(
        { message: "Cannot delete product", error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Product deleted" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error in DELETE handler:", error);
    return NextResponse.json(
      { message: "Cannot delete product", error: error.message },
      { status: 500 }
    );
  }
}
