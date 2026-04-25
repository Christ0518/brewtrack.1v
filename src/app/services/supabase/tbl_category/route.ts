import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

// GET - Get all categories for a shop
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const shopId = url.searchParams.get("shop_id");

    if (!shopId || isNaN(Number(shopId))) {
      return NextResponse.json(
        { message: "Invalid shop ID" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseServer
      .from("tbl_category")
      .select("id, name")
      .eq("shop_id", shopId)
      .is("deleted_at", null);

    if (error) {
      console.error("Error fetching categories:", error);
      return NextResponse.json(
        { message: "Cannot get categories", error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data || [], { status: 200 });
  } catch (error) {
    console.error("Error in GET handler:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create a new category
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const shopId = url.searchParams.get("shop_id");
    const { name } = await req.json();

    if (!shopId || isNaN(Number(shopId))) {
      return NextResponse.json(
        { message: "Invalid shop ID" },
        { status: 400 }
      );
    }

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { message: "Missing or invalid category name" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseServer
      .from("tbl_category")
      .insert([{ name: name.trim(), shop_id: shopId }])
      .select("id");

    if (error) {
      console.error("Error adding category:", error);
      return NextResponse.json(
        { message: "Cannot add category", error: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { message: "Failed to create category" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { id: data[0].id, message: "Category added" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST handler:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Soft delete a category
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
        { message: "Invalid category ID" },
        { status: 400 }
      );
    }

    // First check if category exists (regardless of deleted status)
    const { data: existingCategory, error: checkError } = await supabaseServer
      .from("tbl_category")
      .select("id, deleted_at")
      .eq("id", id)
      .eq("shop_id", shopId)
      .limit(1);

    if (checkError) {
      console.error("Error checking category:", checkError);
      return NextResponse.json(
        { message: "Cannot check category", error: checkError.message },
        { status: 500 }
      );
    }

    if (!existingCategory || existingCategory.length === 0) {
      return NextResponse.json(
        { message: "Category not found" },
        { status: 404 }
      );
    }

    // If already deleted, return success
    if (existingCategory[0].deleted_at !== null) {
      return NextResponse.json(
        { message: "Category already deleted" },
        { status: 200 }
      );
    }

    // Delete the category
    const { data, error } = await supabaseServer
      .from("tbl_category")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("shop_id", shopId)
      .select();

    if (error) {
      console.error("Error deleting category:", error);
      return NextResponse.json(
        { message: "Cannot delete category", error: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { message: "Category not found or already deleted" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Category deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in DELETE handler:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
