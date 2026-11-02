import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { addDecimalStrings, normalizeNonNegativeDecimal, sumDecimalStrings } from "@/lib/decimal";
import { sanitizeInsertPayload } from "@/lib/sanitizeInsertPayload";

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const shopId = url.searchParams.get("shop_id");
    const { ingredient_id, quantity, unit_price, expiration_date } = await req.json();

    if (!shopId || !Number.isInteger(Number(shopId)) || Number(shopId) <= 0) {
      return NextResponse.json({ message: "Invalid shop ID" }, { status: 400 });
    }

    if (!Number.isInteger(Number(ingredient_id)) || Number(ingredient_id) <= 0) {
      return NextResponse.json({ message: "Invalid ingredient ID" }, { status: 400 });
    }

    const batchQuantity = normalizeNonNegativeDecimal(quantity);
    if (batchQuantity === null || !/[1-9]/.test(batchQuantity)) {
      return NextResponse.json(
        { message: "Quantity must be a positive decimal number" },
        { status: 400 }
      );
    }

    const unitPrice = normalizeNonNegativeDecimal(unit_price);
    if (unitPrice === null) {
      return NextResponse.json(
        { message: "Cost per unit must be a valid non-negative decimal number" },
        { status: 400 }
      );
    }

    if (
      typeof expiration_date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(expiration_date) ||
      Number.isNaN(new Date(`${expiration_date}T00:00:00`).getTime())
    ) {
      return NextResponse.json(
        { message: "A valid expiration date is required" },
        { status: 400 }
      );
    }

    const { data: ingredient, error: ingredientError } = await supabaseServer
      .from("tbl_ingredients")
      .select("id")
      .eq("id", Number(ingredient_id))
      .eq("shop_id", Number(shopId))
      .eq("is_deleted", 0)
      .maybeSingle();

    if (ingredientError) {
      console.error("Error validating batch ingredient:", ingredientError);
      return NextResponse.json(
        { message: "Cannot validate ingredient", error: ingredientError.message },
        { status: 500 }
      );
    }

    if (!ingredient) {
      return NextResponse.json({ message: "Ingredient not found" }, { status: 404 });
    }

    const { data: inventory, error: inventoryLookupError } = await supabaseServer
      .from("tbl_inventory")
      .select("id, quantity")
      .eq("ingredient_id", Number(ingredient_id))
      .maybeSingle();

    if (inventoryLookupError) {
      console.error("Error checking ingredient inventory:", inventoryLookupError);
      return NextResponse.json(
        { message: "Cannot check ingredient inventory", error: inventoryLookupError.message },
        { status: 500 }
      );
    }

    const { data: existingBatches, error: batchesLookupError } = await supabaseServer
      .from("ingredient_batches")
      .select("quantity, remaining_quantity")
      .eq("ingredient_id", Number(ingredient_id));

    if (batchesLookupError) {
      console.error("Error checking existing ingredient batches:", batchesLookupError);
      return NextResponse.json(
        { message: "Cannot check existing ingredient batches", error: batchesLookupError.message },
        { status: 500 }
      );
    }

    const currentQuantity = inventory?.quantity !== null && inventory?.quantity !== undefined
      ? normalizeNonNegativeDecimal(inventory.quantity) ?? "0"
      : sumDecimalStrings(
          (existingBatches || []).map((batch) => batch.remaining_quantity ?? batch.quantity)
        );
    const totalQuantity = addDecimalStrings(currentQuantity, batchQuantity);

    const createdAt = new Date().toISOString();
    const { data: batch, error: batchError } = await supabaseServer
      .from("ingredient_batches")
      .insert([sanitizeInsertPayload({
        ingredient_id: Number(ingredient_id),
        quantity: batchQuantity,
        remaining_quantity: batchQuantity,
        expiration_date,
        unit_price: unitPrice,
        created_at: createdAt,
      })])
      .select("id")
      .single();

    if (batchError) {
      console.error("Error creating ingredient batch:", batchError);
      const batchSequenceOutOfSync =
        batchError.code === "23505" &&
        batchError.details?.includes("Key (id)=");

      return NextResponse.json(
        {
          message: batchSequenceOutOfSync
            ? "The ingredient batch ID sequence is behind existing rows. Run migrations/011_sync_ingredient_batch_id_sequence.sql in Supabase SQL Editor, then retry."
            : "Cannot create ingredient batch",
          error: batchError.message,
        },
        { status: 500 }
      );
    }

    const inventoryWrite = inventory
      ? await supabaseServer
          .from("tbl_inventory")
          .update({ quantity: totalQuantity })
          .eq("id", inventory.id)
          .select("id")
          .single()
      : await supabaseServer
          .from("tbl_inventory")
          .insert([sanitizeInsertPayload({
            ingredient_id: Number(ingredient_id),
            quantity: totalQuantity,
            minimum_stock: null,
          })])
          .select("id")
          .single();

    if (inventoryWrite.error) {
      console.error("Error saving ingredient inventory:", inventoryWrite.error);
      const { error: rollbackError } = await supabaseServer
        .from("ingredient_batches")
        .delete()
        .eq("id", batch.id);

      if (rollbackError) {
        console.error("Could not roll back ingredient batch:", rollbackError);
      }

      const idDefaultMissing =
        inventoryWrite.error.code === "23502" &&
        inventoryWrite.error.details?.includes('column "id" of relation "tbl_inventory"');

      return NextResponse.json(
        {
          message: idDefaultMissing
            ? "The database is missing the tbl_inventory ID generator. Apply migrations/009_initialize_ingredient_inventory.sql in Supabase SQL Editor."
            : rollbackError
              ? "Cannot save inventory and the new batch could not be rolled back"
              : "Cannot save inventory; the new batch was rolled back",
          error: inventoryWrite.error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Ingredient batch added", batch_id: batch.id, inventory_id: inventoryWrite.data.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating ingredient batch:", error);
    return NextResponse.json(
      {
        message: "Cannot create ingredient batch",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
