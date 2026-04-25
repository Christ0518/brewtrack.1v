import { NextResponse, NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase";

// -------------------- GET VARIANTS BY PRODUCT --------------------
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const productId = url.searchParams.get("product_id");

    if (!productId) {
      return NextResponse.json(
        { message: "product_id is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseServer
      .from("tbl_product_variants")
      .select("*")
      .eq("product_id", productId);

    if (error) {
      console.error("Error fetching variants:", error);
      return NextResponse.json(
        { message: "Cannot get variants", error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data || [], { status: 200 });
  } catch (error: any) {
    console.error("Error in GET handler:", error);
    return NextResponse.json(
      { message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}

// -------------------- POST (ADD VARIANT) --------------------
export async function POST(req: NextRequest) {
  try {
    const { product_id, name, quantity, price, status } = await req.json();

    // Validate input
    if (!product_id || !name || quantity == null || price == null) {
      return NextResponse.json(
        { message: "All fields are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseServer
      .from("tbl_product_variants")
      .insert([
        {
          product_id,
          name,
          quantity: Number(quantity),
          price: Number(price),
          status: status || "active",
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error adding variant:", error);
      return NextResponse.json(
        { message: "Cannot add variant", error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        id: data.id,
        product_id: data.product_id,
        name: data.name,
        quantity: data.quantity,
        price: data.price,
        status: data.status || "active",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error in POST handler:", error);
    return NextResponse.json(
      { message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}

// -------------------- PUT (UPDATE VARIANT) --------------------
export async function PUT(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const { name, quantity, price, status } = await req.json();

    // Validate input
    if (!id || !name || quantity == null || price == null || !status) {
      return NextResponse.json(
        { message: "All fields are required for update" },
        { status: 400 }
      );
    }

    const { error, data } = await supabaseServer
      .from("tbl_product_variants")
      .update({
        name,
        quantity: Number(quantity),
        price: Number(price),
        status,
      })
      .eq("id", id)
      .select();

    if (error) {
      console.error("Error updating variant:", error);
      return NextResponse.json(
        { message: "Cannot update variant", error: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { message: "Variant not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Variant updated successfully", data: data[0] },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error in PUT handler:", error);
    return NextResponse.json(
      { message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}

// -------------------- DELETE (DELETE VARIANT) --------------------
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { message: "id is required" },
        { status: 400 }
      );
    }

    const { error, data } = await supabaseServer
      .from("tbl_product_variants")
      .delete()
      .eq("id", id)
      .select();

    if (error) {
      console.error("Error deleting variant:", error);
      return NextResponse.json(
        { message: "Cannot delete variant", error: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { message: "Variant not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Variant deleted successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error in DELETE handler:", error);
    return NextResponse.json(
      { message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
