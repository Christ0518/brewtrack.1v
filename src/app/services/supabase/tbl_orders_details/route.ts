import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

type OrderDetailPayload = {
  id?: number | string;
  variant_id?: number | string;
  order_id?: number | string;
  quantity?: number | string;
  subtotal?: number | string;
  discount_type?: string | null;
  discount?: number | string | null;
  topping_id?: number | string | null;
};

function parseNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseNullableString(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

function mapRow(row: any) {
  return {
    id: row.id,
    variant_id: row.variant_id,
    order_id: row.order_id,
    quantity: row.quantity,
    subtotal: row.subtotal,
    discount_type: row.discount_type,
    discount: row.discount,
    created_at: row.created_at,
    topping_id: row.topping_id,
  };
}

// GET - List order details or fetch a single row by id/order_id
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const orderId = url.searchParams.get("order_id");

    let query = supabaseServer
      .from("tbl_orders_details")
      .select("id, variant_id, order_id, quantity, subtotal, discount_type, discount, created_at, topping_id")
      .order("id", { ascending: false });

    if (id) {
      if (isNaN(Number(id))) {
        return NextResponse.json({ message: "Invalid detail ID" }, { status: 400 });
      }

      const { data, error } = await query.eq("id", id).single();

      if (error || !data) {
        return NextResponse.json({ message: "Order detail not found" }, { status: 404 });
      }

      return NextResponse.json(mapRow(data), { status: 200 });
    }

    if (orderId) {
      if (isNaN(Number(orderId))) {
        return NextResponse.json({ message: "Invalid order ID" }, { status: 400 });
      }

      query = query.eq("order_id", orderId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching order details:", error);
      return NextResponse.json(
        { message: "Cannot get order details", error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json((data || []).map(mapRow), { status: 200 });
  } catch (error: any) {
    console.error("Error in GET handler:", error);
    return NextResponse.json(
      { message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}

// POST - Create a new order detail row
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as OrderDetailPayload;
    const variantId = parseNumber(body.variant_id);
    const orderId = parseNumber(body.order_id);
    const quantity = parseNumber(body.quantity);
    const subtotal = parseNumber(body.subtotal);
    const discount = parseNumber(body.discount) ?? 0;
    const discountType = parseNullableString(body.discount_type);
    const toppingId = parseNumber(body.topping_id);

    if (!variantId || !orderId || quantity === null || subtotal === null) {
      return NextResponse.json(
        { message: "variant_id, order_id, quantity, and subtotal are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseServer
      .from("tbl_orders_details")
      .insert({
        variant_id: variantId,
        order_id: orderId,
        quantity,
        subtotal,
        discount_type: discountType,
        discount,
        topping_id: toppingId,
      })
      .select("id, variant_id, order_id, quantity, subtotal, discount_type, discount, created_at, topping_id")
      .single();

    if (error) {
      console.error("Error creating order detail:", error);
      return NextResponse.json(
        { message: "Cannot create order detail", error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(mapRow(data), { status: 201 });
  } catch (error: any) {
    console.error("Error in POST handler:", error);
    return NextResponse.json(
      { message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update an order detail row
export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as OrderDetailPayload;
    const id = parseNumber(body.id);

    if (!id) {
      return NextResponse.json({ message: "id is required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};

    const variantId = parseNumber(body.variant_id);
    const orderId = parseNumber(body.order_id);
    const quantity = parseNumber(body.quantity);
    const subtotal = parseNumber(body.subtotal);
    const discount = parseNumber(body.discount);
    const discountType = parseNullableString(body.discount_type);
    const toppingId = parseNumber(body.topping_id);

    if (variantId !== null) updates.variant_id = variantId;
    if (orderId !== null) updates.order_id = orderId;
    if (quantity !== null) updates.quantity = quantity;
    if (subtotal !== null) updates.subtotal = subtotal;
    if (discountType !== undefined) updates.discount_type = discountType;
    if (discount !== null) updates.discount = discount;
    if (body.discount === null) updates.discount = 0;
    if (body.topping_id !== undefined) updates.topping_id = toppingId;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from("tbl_orders_details")
      .update(updates)
      .eq("id", id)
      .select("id, variant_id, order_id, quantity, subtotal, discount_type, discount, created_at, topping_id")
      .single();

    if (error) {
      console.error("Error updating order detail:", error);
      return NextResponse.json(
        { message: "Cannot update order detail", error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ message: "Order detail not found" }, { status: 404 });
    }

    return NextResponse.json(mapRow(data), { status: 200 });
  } catch (error: any) {
    console.error("Error in PUT handler:", error);
    return NextResponse.json(
      { message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete an order detail row
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    let id = url.searchParams.get("id");

    if (!id) {
      try {
        const body = (await req.json()) as OrderDetailPayload;
        id = body.id?.toString() || null;
      } catch {
        // ignore non-JSON bodies
      }
    }

    if (!id || isNaN(Number(id))) {
      return NextResponse.json({ message: "id is required" }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from("tbl_orders_details")
      .delete()
      .eq("id", id)
      .select("id, variant_id, order_id, quantity, subtotal, discount_type, discount, created_at, topping_id")
      .single();

    if (error) {
      console.error("Error deleting order detail:", error);
      return NextResponse.json(
        { message: "Cannot delete order detail", error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ message: "Order detail not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Order detail deleted", data: mapRow(data) }, { status: 200 });
  } catch (error: any) {
    console.error("Error in DELETE handler:", error);
    return NextResponse.json(
      { message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
