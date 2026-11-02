import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { addDecimalStrings, normalizeNonNegativeDecimal, sumDecimalStrings } from "@/lib/decimal";
import { sanitizeInsertPayload } from "@/lib/sanitizeInsertPayload";

// GET - Get all ingredients or single ingredient
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

    // Single ingredient
    if (id) {
      if (isNaN(Number(id))) {
        return NextResponse.json(
          { message: "Invalid ingredient ID" },
          { status: 400 }
        );
      }

      const { data, error } = await supabaseServer
        .from("tbl_ingredients")
        .select(`
          id,
          ingredient_name,
          unit,
          unit_price,
          expiration_date
        `)
        .eq("id", id)
        .eq("shop_id", shopId)
        .eq("is_deleted", 0)
        .maybeSingle();

      if (error) {
        console.error("Error fetching ingredient:", error);
        return NextResponse.json(
          { message: "Cannot get ingredient", error: error.message },
          { status: 500 }
        );
      }

      if (!data) {
        return NextResponse.json(
          { message: "Ingredient not found" },
          { status: 404 }
        );
      }

      // Get inventory
      const { data: invData, error: inventoryError } = await supabaseServer
        .from("tbl_inventory")
        .select("quantity, minimum_stock")
        .eq("ingredient_id", id)
        .maybeSingle();

      if (inventoryError) {
        console.error("Error fetching ingredient inventory:", inventoryError);
        return NextResponse.json(
          { message: "Cannot get ingredient inventory", error: inventoryError.message },
          { status: 500 }
        );
      }

      const { data: batches, error: batchesError } = await supabaseServer
        .from("ingredient_batches")
        .select("id, quantity, remaining_quantity, expiration_date, unit_price, created_at")
        .eq("ingredient_id", id)
        .order("expiration_date", { ascending: true, nullsFirst: false });

      if (batchesError) {
        console.error("Error fetching ingredient batches:", batchesError);
        return NextResponse.json(
          { message: "Cannot get ingredient batches", error: batchesError.message },
          { status: 500 }
        );
      }

      const ingredient = {
        ...data,
        quantity: Number(invData?.quantity) > 0
          ? invData?.quantity
          : batches?.length
            ? sumDecimalStrings(batches.map((batch: any) => batch.remaining_quantity ?? batch.quantity))
            : invData?.quantity ?? null,
        minimum_stock: invData?.minimum_stock ?? null,
        batches: batches || []
      };

      return NextResponse.json(ingredient, { status: 200 });
    }

    // All ingredients
    const { data, error } = await supabaseServer
      .from("tbl_ingredients")
      .select(`
        id,
        ingredient_name,
        unit,
        unit_price,
        expiration_date
      `)
      .eq("shop_id", shopId)
      .eq("is_deleted", 0)
      .order("id", { ascending: false });

    if (error) {
      console.error("Error fetching ingredients:", error);
      return NextResponse.json(
        { message: "Cannot get ingredients", error: error.message },
        { status: 500 }
      );
    }

    // Get all inventory records
    const { data: invData, error: inventoryError } = await supabaseServer
      .from("tbl_inventory")
      .select("ingredient_id, quantity, minimum_stock");

    if (inventoryError) {
      console.error("Error fetching ingredient inventory:", inventoryError);
      return NextResponse.json(
        { message: "Cannot get ingredient inventory", error: inventoryError.message },
        { status: 500 }
      );
    }

    const invMap = new Map(
      invData?.map((inv: any) => [
        inv.ingredient_id,
        { quantity: inv.quantity, minimum_stock: inv.minimum_stock }
      ]) || []
    );

    const ingredientIds = data.map((ingredient: any) => ingredient.id);
    const { data: batchData, error: batchError } = ingredientIds.length
      ? await supabaseServer
          .from("ingredient_batches")
          .select("id, ingredient_id, quantity, remaining_quantity, expiration_date, unit_price, created_at")
          .in("ingredient_id", ingredientIds)
          .order("expiration_date", { ascending: true, nullsFirst: false })
      : { data: [] };

    if (batchError) {
      console.error("Error fetching ingredient batches:", batchError);
      return NextResponse.json(
        { message: "Cannot get ingredient batches", error: batchError.message },
        { status: 500 }
      );
    }

    const batchMap = new Map<number, any[]>();
    (batchData || []).forEach((batch: any) => {
      const current = batchMap.get(batch.ingredient_id) || [];
      current.push(batch);
      batchMap.set(batch.ingredient_id, current);
    });

    const ingredients = data.map((ing: any) => {
      const inv = invMap.get(ing.id);
      const batches = batchMap.get(ing.id) || [];
      return {
        ...ing,
        quantity: Number(inv?.quantity) > 0
          ? inv?.quantity
          : batches.length
            ? sumDecimalStrings(batches.map((batch: any) => batch.remaining_quantity ?? batch.quantity))
            : inv?.quantity ?? null,
        minimum_stock: inv?.minimum_stock ?? null,
        batches
      };
    });

    

    return NextResponse.json(ingredients, { status: 200 });
  } catch (error) {
    console.error("Error in GET handler:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Add ingredient + inventory
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const shopId = url.searchParams.get("shop_id");
    const { ingredient_name, unit, quantity, unit_price, minimum_stock, expiration_date } = await req.json();

    if (!shopId || isNaN(Number(shopId))) {
      return NextResponse.json(
        { message: "Invalid shop ID" },
        { status: 400 }
      );
    }

    if (!ingredient_name || !unit) {
      return NextResponse.json(
        { message: "Missing required fields (ingredient_name, unit)" },
        { status: 400 }
      );
    }

    if (!expiration_date) {
      return NextResponse.json(
        { message: "Expiration date is required for each ingredient batch" },
        { status: 400 }
      );
    }

    // Validate unit_price
    let price: string | null = null;
    if (unit_price !== undefined && unit_price !== null) {
      price = normalizeNonNegativeDecimal(unit_price);
      if (price === null) {
        return NextResponse.json(
          { message: "Invalid unit price" },
          { status: 400 }
        );
      }
    }

    // Prepare quantity (default to 0 if not provided)
    const qty = quantity === undefined || quantity === null || quantity === ""
      ? "0"
      : normalizeNonNegativeDecimal(quantity);

    if (qty === null) {
      return NextResponse.json(
        { message: "Invalid quantity" },
        { status: 400 }
      );
    }

    const { data: existingIngredient, error: existingIngredientError } = await supabaseServer
      .from("tbl_ingredients")
      .select("id, unit_price")
      .eq("shop_id", shopId)
      .eq("ingredient_name", ingredient_name.trim())
      .eq("is_deleted", 0)
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingIngredientError) {
      return NextResponse.json(
        { message: "Cannot find ingredient", error: existingIngredientError.message },
        { status: 500 }
      );
    }

    let ingredient_id = existingIngredient?.id;
    if (!ingredient_id) {
      const { data: ingredientData, error: ingredientError } = await supabaseServer
        .from("tbl_ingredients")
        .insert([sanitizeInsertPayload({
          ingredient_name: ingredient_name.trim(),
          unit,
          unit_price: price,
          expiration_date: expiration_date,
          shop_id: shopId,
          is_deleted: 0
        })])
        .select("id")
        .single();

      if (ingredientError) {
        console.error("Error adding ingredient:", ingredientError);
        return NextResponse.json(
          { message: "Cannot add ingredient", error: ingredientError.message },
          { status: 500 }
        );
      }
      ingredient_id = ingredientData.id;
    }

    const { data: inventoryData, error: inventoryLookupError } = await supabaseServer
      .from("tbl_inventory")
      .select("id, quantity, minimum_stock")
      .eq("ingredient_id", ingredient_id)
      .maybeSingle();

    if (inventoryLookupError) {
      console.error("Error checking existing inventory:", inventoryLookupError);
      return NextResponse.json(
        { message: "Cannot check existing inventory", error: inventoryLookupError.message },
        { status: 500 }
      );
    }

    const totalQuantity = addDecimalStrings(
      normalizeNonNegativeDecimal(inventoryData?.quantity ?? 0) ?? "0",
      qty
    );
    const { data: savedBatch, error: batchError } = await supabaseServer
      .from("ingredient_batches")
      .insert([sanitizeInsertPayload({
        ingredient_id,
        quantity: qty,
        remaining_quantity: qty,
        expiration_date,
        unit_price: price ?? normalizeNonNegativeDecimal(existingIngredient?.unit_price) ?? null,
        created_at: new Date().toISOString(),
      })])
      .select("id")
      .single();

    if (batchError) {
      console.error("Error adding ingredient batch:", batchError);
      const batchSequenceOutOfSync =
        batchError.code === "23505" &&
        batchError.details?.includes("Key (id)=");

      return NextResponse.json(
        {
          message: batchSequenceOutOfSync
            ? "The ingredient batch ID sequence is behind existing rows. Run migrations/011_sync_ingredient_batch_id_sequence.sql in Supabase SQL Editor, then retry."
            : "Cannot add ingredient batch",
          error: batchError.message,
        },
        { status: 500 }
      );
    }

    const inventoryWrite = inventoryData
      ? await supabaseServer
          .from("tbl_inventory")
          .update({
            quantity: totalQuantity,
            minimum_stock: minimum_stock ?? inventoryData.minimum_stock,
          })
          .eq("id", inventoryData.id)
          .select("id")
          .single()
      : await supabaseServer
          .from("tbl_inventory")
          .insert([sanitizeInsertPayload({
            ingredient_id,
            quantity: totalQuantity,
            minimum_stock: minimum_stock ?? null,
          })])
          .select("id")
          .single();

    if (inventoryWrite.error) {
      console.error("Error saving inventory:", inventoryWrite.error);
      const { error: rollbackError } = await supabaseServer
        .from("ingredient_batches")
        .delete()
        .eq("id", savedBatch.id);

      if (rollbackError) {
        console.error("Could not roll back ingredient batch:", rollbackError);
      }

      const missingInventoryIdDefault =
        inventoryWrite.error.code === "23502" &&
        inventoryWrite.error.details?.includes('column "id" of relation "tbl_inventory"');

      return NextResponse.json(
        {
          message: missingInventoryIdDefault
            ? "The database is missing the tbl_inventory ID generator. Apply migrations/009_initialize_ingredient_inventory.sql in Supabase SQL Editor."
            : rollbackError
              ? "Cannot save inventory and the ingredient batch could not be rolled back"
              : "Cannot save inventory; the ingredient batch was rolled back",
          error: inventoryWrite.error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Ingredient + inventory saved",
        batch_id: savedBatch.id,
        ingredient_id,
        inventory_id: inventoryWrite.data.id
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error in POST handler:", error);
    return NextResponse.json(
      { message: "Error saving ingredient", error: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update ingredient + inventory
export async function PUT(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const shopId = url.searchParams.get("shop_id");
    const { ingredient_name, unit, quantity, unit_price, minimum_stock, expiration_date } = await req.json();

    if (!shopId || isNaN(Number(shopId))) {
      return NextResponse.json(
        { message: "Invalid shop ID" },
        { status: 400 }
      );
    }

    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { message: "Invalid ingredient ID" },
        { status: 400 }
      );
    }

    if (!ingredient_name || !unit) {
      return NextResponse.json(
        { message: "Missing required fields (ingredient_name, unit)" },
        { status: 400 }
      );
    }

    // Validate unit_price
    let price: string | null = null;
    if (unit_price !== undefined && unit_price !== null) {
      price = normalizeNonNegativeDecimal(unit_price);
      if (price === null) {
        return NextResponse.json(
          { message: "Invalid unit price" },
          { status: 400 }
        );
      }
    }

    // Update ingredient
    const updateData: any = {
      ingredient_name,
      unit
    };
    if (price !== null) {
      updateData.unit_price = price;
    }
    if (expiration_date !== undefined) {
      updateData.expiration_date = expiration_date || null;
    }

    const { data: ingredientData, error: ingredientError } = await supabaseServer
      .from("tbl_ingredients")
      .update(updateData)
      .eq("id", id)
      .eq("shop_id", shopId)
      .eq("is_deleted", 0)
      .select();

    if (ingredientError) {
      console.error("Error updating ingredient:", ingredientError);
      return NextResponse.json(
        { message: "Cannot update ingredient", error: ingredientError.message },
        { status: 500 }
      );
    }

    if (!ingredientData || ingredientData.length === 0) {
      return NextResponse.json(
        { message: "Ingredient not found" },
        { status: 404 }
      );
    }

    // Update inventory quantity if provided

    const updateInvData: any = {};

if (quantity !== undefined) {
  const normalizedQuantity =
    quantity === null || quantity === "" ? null : normalizeNonNegativeDecimal(quantity);

  if (quantity !== null && quantity !== "" && normalizedQuantity === null) {
    return NextResponse.json({ message: "Invalid quantity" }, { status: 400 });
  }

  updateInvData.quantity = normalizedQuantity;
}

if (minimum_stock !== undefined) {
  updateInvData.minimum_stock =
    minimum_stock === null || minimum_stock === ""
      ? null
      : Number(minimum_stock);
}

if (Object.keys(updateInvData).length > 0) {
  const { data: inventoryData, error: inventoryLookupError } = await supabaseServer
    .from("tbl_inventory")
    .select("id")
    .eq("ingredient_id", id)
    .maybeSingle();

  if (inventoryLookupError) {
    console.error("Error checking ingredient inventory:", inventoryLookupError);
    return NextResponse.json(
      { message: "Cannot check ingredient inventory", error: inventoryLookupError.message },
      { status: 500 }
    );
  }

  const inventoryWrite = inventoryData
    ? await supabaseServer
        .from("tbl_inventory")
        .update(updateInvData)
        .eq("id", inventoryData.id)
    : await supabaseServer
        .from("tbl_inventory")
        .insert([sanitizeInsertPayload({ ingredient_id: Number(id), ...updateInvData })]);

  if (inventoryWrite.error) {
    console.error("Error saving ingredient inventory:", inventoryWrite.error);
    const missingInventoryIdDefault =
      inventoryWrite.error.code === "23502" &&
      inventoryWrite.error.details?.includes('column "id" of relation "tbl_inventory"');

    return NextResponse.json(
      {
        message: missingInventoryIdDefault
          ? "The database is missing the tbl_inventory ID generator. Apply migrations/009_initialize_ingredient_inventory.sql in Supabase SQL Editor, then retry."
          : "Cannot save ingredient inventory",
        error: inventoryWrite.error.message,
      },
      { status: 500 }
    );
  }
}

    return NextResponse.json(
      { message: "Ingredient updated" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error in PUT handler:", error);
    return NextResponse.json(
      { message: "Cannot update ingredient", error: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Soft delete ingredient
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
        { message: "Invalid ingredient ID" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseServer
      .from("tbl_ingredients")
      .update({ is_deleted: 1 })
      .eq("id", id)
      .eq("shop_id", shopId)
      .select();

    if (error) {
      console.error("Error deleting ingredient:", error);
      return NextResponse.json(
        { message: "Cannot delete ingredient", error: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { message: "Ingredient not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Ingredient deleted" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error in DELETE handler:", error);
    return NextResponse.json(
      { message: "Cannot delete ingredient", error: error.message },
      { status: 500 }
    );
  }
}
