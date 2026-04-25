import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

// GET ALL ADD-ONS
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    // Get single add-on by ID
    if (id) {
      const { data, error } = await supabaseServer
        .from("tbl_toppings")
        .select("id, name, quantity, unit, price, unit_price, quantity_per_item, is_deleted")
        .eq("id", id)
        .or("is_deleted.eq.0,is_deleted.is.null")
        .single();

      if (error || !data) {
        return NextResponse.json({ message: "Add-on not found" }, { status: 404 });
      }

      return NextResponse.json(data);
    }

    // Get all add-ons
    const { data, error } = await supabaseServer
      .from("tbl_toppings")
      .select("id, name, quantity, unit, price, unit_price, quantity_per_item, is_deleted")
      .or("is_deleted.eq.0,is_deleted.is.null")
      .order("id", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error("Cannot get add-ons:", error);
    return NextResponse.json(
      { message: "Cannot get add-ons", error: error.message },
      { status: 500 }
    );
  }
}

// CREATE ADD-ON
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, quantity, unit, price, unit_price, quantity_per_item } = body;

    // Validation
    if (!name || quantity === undefined || !unit || price === undefined) {
      return NextResponse.json(
        { message: "Missing required fields: name, quantity, unit, price" },
        { status: 400 }
      );
    }

    // Parse and validate quantity
    let parsedQuantity = parseFloat(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity < 0) {
      return NextResponse.json({ message: "Invalid quantity" }, { status: 400 });
    }

    // Parse and validate price
    let parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return NextResponse.json({ message: "Invalid price" }, { status: 400 });
    }

    // Parse unit_price (optional)
    let parsedUnitPrice: number | null = null;
    if (unit_price !== undefined && unit_price !== null) {
      parsedUnitPrice = parseFloat(unit_price);
      if (isNaN(parsedUnitPrice) || parsedUnitPrice < 0) {
        return NextResponse.json({ message: "Invalid unit price" }, { status: 400 });
      }
    }

    // Parse quantity_per_item (optional, defaults to 1)
    let parsedQuantityPerItem = parseFloat(quantity_per_item) || 1;
    if (isNaN(parsedQuantityPerItem) || parsedQuantityPerItem < 0) {
      parsedQuantityPerItem = 1;
    }

    // Insert add-on
    const { data, error } = await supabaseServer
      .from("tbl_toppings")
      .insert({
        name,
        quantity: parsedQuantity,
        unit,
        price: parsedPrice,
        unit_price: parsedUnitPrice,
        quantity_per_item: parsedQuantityPerItem,
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json(
      {
        message: "Add-on saved successfully",
        id: data.id,
        name,
        quantity: parsedQuantity,
        unit,
        price: parsedPrice,
        unit_price: parsedUnitPrice,
        quantity_per_item: parsedQuantityPerItem,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error saving add-on:", error);
    return NextResponse.json(
      { message: "Error saving add-on", error: error.message },
      { status: 500 }
    );
  }
}

// UPDATE ADD-ON
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, quantity, unit, price, unit_price, quantity_per_item } = body;

    if (!id) {
      return NextResponse.json({ message: "Add-on ID is required" }, { status: 400 });
    }

    // Validation
    if (!name || quantity === undefined || !unit || price === undefined) {
      return NextResponse.json(
        { message: "Missing required fields: name, quantity, unit, price" },
        { status: 400 }
      );
    }

    // Parse and validate quantity
    let parsedQuantity = parseFloat(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity < 0) {
      return NextResponse.json({ message: "Invalid quantity" }, { status: 400 });
    }

    // Parse and validate price
    let parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return NextResponse.json({ message: "Invalid price" }, { status: 400 });
    }

    // Parse unit_price (optional)
    let parsedUnitPrice: number | null = null;
    if (unit_price !== undefined && unit_price !== null) {
      parsedUnitPrice = parseFloat(unit_price);
      if (isNaN(parsedUnitPrice) || parsedUnitPrice < 0) {
        return NextResponse.json({ message: "Invalid unit price" }, { status: 400 });
      }
    }

    // Parse quantity_per_item (optional, defaults to 1)
    let parsedQuantityPerItem = parseFloat(quantity_per_item) || 1;
    if (isNaN(parsedQuantityPerItem) || parsedQuantityPerItem < 0) {
      parsedQuantityPerItem = 1;
    }

    // Update add-on
    const { error, data: updateData } = await supabaseServer
      .from("tbl_toppings")
      .update({
        name,
        quantity: parsedQuantity,
        unit,
        price: parsedPrice,
        unit_price: parsedUnitPrice,
        quantity_per_item: parsedQuantityPerItem,
      })
      .eq("id", id)
      .select();

    if (error) throw error;

    if (!updateData || updateData.length === 0) {
      return NextResponse.json({ message: "Add-on not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Add-on updated successfully" });
  } catch (error: any) {
    console.error("Cannot update add-on:", error);
    return NextResponse.json(
      { message: "Cannot update add-on", error: error.message },
      { status: 500 }
    );
  }
}

// DELETE ADD-ON (soft delete)
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ message: "Add-on ID is required" }, { status: 400 });
    }

    // Soft delete by setting is_deleted = true
    const { error, data } = await supabaseServer
      .from("tbl_toppings")
      .update({ is_deleted: true })
      .eq("id", id)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return NextResponse.json({ message: "Add-on not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Add-on deleted successfully" });
  } catch (error: any) {
    console.error("Cannot delete add-on:", error);
    return NextResponse.json(
      { message: "Cannot delete add-on", error: error.message },
      { status: 500 }
    );
  }
}
