import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

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
          unit_price
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
      const { data: invData } = await supabaseServer
        .from("tbl_inventory")
        .select("quantity, minimum_stock")
        .eq("ingredient_id", id)
        .maybeSingle();

      const ingredient = {
        ...data,
        quantity: invData?.quantity || null,
        minimum_stock:invData?.minimum_stock || null
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
        unit_price
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
    const { data: invData } = await supabaseServer
      .from("tbl_inventory")
      .select("ingredient_id, quantity, minimum_stock");

    console.log("DEBUG - invData from tbl_inventory:", invData);

    const invMap = new Map(
      invData?.map((inv: any) => [
        inv.ingredient_id,
        { quantity: inv.quantity, minimum_stock: inv.minimum_stock }
      ]) || []
    );

    console.log("DEBUG - invMap:", Array.from(invMap.entries()));

    const ingredients = data.map((ing: any) => {
      const inv = invMap.get(ing.id);
      console.log(`DEBUG - ingredient ${ing.id} (${ing.ingredient_name}): inv =`, inv);
      return {
        ...ing,
        quantity: inv?.quantity || null,
        minimum_stock: inv?.minimum_stock || null
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
    const { ingredient_name, unit, quantity, unit_price, minimum_stock } = await req.json();

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

    // Validate unit_price
    let price: number | null = null;
    if (unit_price !== undefined && unit_price !== null) {
      price = parseFloat(unit_price);
      if (isNaN(price) || price < 0) {
        return NextResponse.json(
          { message: "Invalid unit price" },
          { status: 400 }
        );
      }
    }

    // Prepare quantity (default to 0 if not provided)
    const qty = (quantity === undefined || quantity === null || quantity === "") 
      ? 0
      : Number(quantity);

    // Insert ingredient
    const { data: ingredientData, error: ingredientError } = await supabaseServer
      .from("tbl_ingredients")
      .insert([{
        ingredient_name,
        unit,
        unit_price: price,
        shop_id: shopId,
        is_deleted: 0
      }])
      .select("id");

    if (ingredientError) {
      console.error("Error adding ingredient:", ingredientError);
      return NextResponse.json(
        { message: "Cannot add ingredient", error: ingredientError.message },
        { status: 500 }
      );
    }

    const ingredient_id = ingredientData[0].id;

    // Insert inventory record
    const { data: inventoryData, error: inventoryError } = await supabaseServer
      .from("tbl_inventory")
      .insert([{
        ingredient_id,
        quantity: qty,
        minimum_stock: minimum_stock ?? null
      }])
      .select("id");

    if (inventoryError) {
      console.error("Error adding inventory:", inventoryError);
      return NextResponse.json(
        { message: "Cannot add inventory", error: inventoryError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Ingredient + inventory saved",
        ingredient_id,
        inventory_id: inventoryData[0].id
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
    const { ingredient_name, unit, quantity, unit_price, minimum_stock } = await req.json();

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
    let price: number | null = null;
    if (unit_price !== undefined && unit_price !== null) {
      price = parseFloat(unit_price);
      if (isNaN(price) || price < 0) {
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
  updateInvData.quantity = (quantity === null || quantity === "") ? null : Number(quantity);
}

if (minimum_stock !== undefined) {
  updateInvData.minimum_stock =
    minimum_stock === null || minimum_stock === ""
      ? null
      : Number(minimum_stock);
}

if (Object.keys(updateInvData).length > 0) {
  const { error: inventoryError } = await supabaseServer
    .from("tbl_inventory")
    .update(updateInvData)
    .eq("ingredient_id", id);

  if (inventoryError) {
    console.error("Error updating inventory:", inventoryError);
    return NextResponse.json(
      { message: "Cannot update inventory", error: inventoryError.message },
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
