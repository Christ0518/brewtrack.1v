import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { supabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const verifyAdmin = async (adminPassword: unknown, shopId: string | null) => {
  if (!adminPassword || !shopId) return false;

  const { data: admins, error } = await supabaseServer
    .from("tbl_users")
    .select("password, role")
    .eq("shop_id", Number(shopId))
    .eq("role", "admin");

  if (error || !admins?.length) return false;

  for (const admin of admins) {
    try {
      if (await bcrypt.compare(String(adminPassword), String(admin.password || ""))) return true;
    } catch {
      // Fall back to plaintext comparison for legacy user rows.
    }

    if (String(adminPassword) === String(admin.password || "")) return true;
  }

  return false;
};


// CREATE ORDER with inventory deduction
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("📦 Incoming order payload:", JSON.stringify(body, null, 2));
    
    const {
      cashier_id,
      order_type,
      status,
      total,
      items,
      discount_type,
      discount,
      paid,
      change,
      customer_name,
      table_number,
      notes
    } = body;
    const shopId = req.headers.get("x-shop-id") || "1";

    console.log("📋 Parsed values:", {
      cashier_id,
      order_type,
      status,
      total,
      items: items?.length,
      shopId
    });

    // Validation
    if (total === undefined || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { message: "Missing required fields: total, items" },
        { status: 400 }
      );
    }

    // For online orders (no cashier), use null
    const finalCashierId = cashier_id || null;

    // Prepare cart items for deduction (convert variant_id to number)
    const cartItems = items.map((item: any) => ({
      variant_id: Number(item.variant_id),
      quantity: Number(item.quantity)
    }));

    const addOnRequirements = new Map<number, number>();
    for (const item of items) {
      for (const addOn of item.addOns || []) {
        const addOnId = Number(addOn.id);
        const required = (Number(addOn.quantity_per_item) || 1) * Number(item.quantity);
        if (!Number.isNaN(addOnId)) {
          addOnRequirements.set(addOnId, (addOnRequirements.get(addOnId) || 0) + required);
        }
      }
    }

    for (const [addOnId, required] of addOnRequirements) {
      const { data: topping, error: toppingError } = await supabaseServer
        .from("tbl_toppings")
        .select("id, name, quantity")
        .eq("id", addOnId)
        .eq("is_deleted", false)
        .single();

      if (toppingError || !topping || Number(topping.quantity) < required) {
        return NextResponse.json(
          { message: `Not enough ${topping?.name || "add-on"}. Need ${required}, only ${Number(topping?.quantity) || 0} available` },
          { status: 400 }
        );
      }
    }

    // Deduct inventory based on recipe logic
    

    

    // Create order header
    const { data: orderData, error: orderError } = await supabaseServer
      .from("tbl_orders")
      .insert({
        cashier_id: finalCashierId,
        order_type: order_type || "dine-in",
        status: status || "completed",
        accepted_at: String(status || "completed").toLowerCase() === "preparing"
          ? new Date().toISOString()
          : null,
        total: Number(total),
        discount_type: discount_type || null,
        discount: discount ? Number(discount) : 0,
        paid: paid ? Number(paid) : Number(total),
        change: change ? Number(change) : 0,
        shop_id: Number(shopId),
        customer_name: customer_name?.trim() ? customer_name : "Walk-in",
        table_number: table_number ? Number(table_number) : null,
        notes: notes || null
      })
      .select("id")
      .single();

    if (orderError) {
      console.error("Supabase order creation error:", {
        error: orderError,
        message: orderError.message,
        code: orderError.code,
        details: orderError.details
      });
      return NextResponse.json(
        { 
          success: false, 
          message: "Failed to create order", 
          error: orderError.message,
          code: orderError.code,
          details: orderError.details
        },
        { status: 500 }
      );
    }

    const orderId = orderData.id;

    // Create order items
    const orderItems = items.map((item: any) => ({
      order_id: orderId,
      variant_id: Number(item.variant_id),
      quantity: Number(item.quantity),
      subtotal: (Number(item.price) || 0) * Number(item.quantity),
      discount_type: item.discount_type || null,
      discount: item.discount ? Number(item.discount) : 0
    }));

    const { error: itemsError } = await supabaseServer
      .from("tbl_orders_details")
      .insert(orderItems);

    if (itemsError) {
      console.error("Warning: Order created but items not linked:", itemsError);
    }

    for (const [addOnId, required] of addOnRequirements) {
      const { data: topping } = await supabaseServer
        .from("tbl_toppings")
        .select("quantity")
        .eq("id", addOnId)
        .single();

      if (topping) {
        await supabaseServer
          .from("tbl_toppings")
          .update({ quantity: Math.max(0, Number(topping.quantity) - required) })
          .eq("id", addOnId);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: "Order created and inventory deducted",
        order_id: orderId,
        
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("❌ Create order error:", error);
    return NextResponse.json(
      { message: "Cannot create order", error: error.message },
      { status: 500 }
    );
  }
}

// GET ORDERS
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const shopId = req.headers.get("x-shop-id") || url.searchParams.get("shop_id");

    if (!shopId || Number.isNaN(Number(shopId))) {
      return NextResponse.json(
        { message: "shop_id is required" },
        { status: 400 }
      );
    }

    const { data: orders, error: ordersError } = await supabaseServer
      .from("tbl_orders")
      .select(
        `
        id,
        cashier_id,
        order_type,
        status,
        total,
        discount_type,
        discount,
        paid,
        change,
        created_at,
        last_edited_at,
        accepted_at,
        customer_name,
        notes,
        edit_reason
      `
      )
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false });

    if (ordersError) throw ordersError;

    const orderIds = (orders || []).map((order) => order.id);
    const { data: allItems, error: itemsError } = orderIds.length
      ? await supabaseServer
          .from("tbl_orders_details")
          .select(
            `
            order_id,
            id,
            variant_id,
            quantity,
            subtotal,
            discount_type,
            discount,
            tbl_product_variants (
              id,
              name,
              calculated_cost,
              price,
              tbl_products (
                id,
                product_name
              )
            )
          `
          )
          .in("order_id", orderIds)
      : { data: [], error: null };

    if (itemsError) throw itemsError;

    const itemsByOrder = new Map<number, any[]>();
    (allItems || []).forEach((item: any) => {
      const orderItems = itemsByOrder.get(item.order_id) || [];
      orderItems.push(item);
      itemsByOrder.set(item.order_id, orderItems);
    });

    const ordersWithItems = (orders || []).map((order) => {
        const items = itemsByOrder.get(order.id) || [];

        const formattedItems = items?.map((item: any) => {
          const variant = Array.isArray(item.tbl_product_variants)
            ? item.tbl_product_variants[0]
            : item.tbl_product_variants;
          const product = variant?.tbl_products
            ? Array.isArray(variant.tbl_products)
              ? variant.tbl_products[0]
              : variant.tbl_products
            : null;

          return {
            id: item.id,
            variant_id: item.variant_id,
            quantity: item.quantity,
            subtotal: item.subtotal,
            discount_type: item.discount_type,
            discount: item.discount,
            product_name: product?.product_name,
            variant_name: variant?.name,
            calculated_cost: variant?.calculated_cost,
            price: variant?.price,
          };
        });

        return { ...order, items: formattedItems };
      });

    return NextResponse.json(ordersWithItems, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("Get orders error:", error);
    return NextResponse.json(
      { message: "Cannot get orders", error: error.message },
      { status: 500 }
    );
  }
}

// UPDATE ORDER
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, items, total, discount_type, discount, paid, change, customer_name, notes, edit_reason, admin_password } = body;
    const shopId = req.headers.get("x-shop-id");

    if (!(await verifyAdmin(admin_password, shopId))) {
      return NextResponse.json({ message: "Admin password is required to edit an order" }, { status: 403 });
    }

    if (!id || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { message: "Missing required fields: order id and items" },
        { status: 400 }
      );
    }

    // Get old items to restore ingredients
    const { data: oldItems, error: oldItemsError } = await supabaseServer
      .from("tbl_orders_details")
      .select("id, variant_id, quantity")
      .eq("order_id", id);

    if (oldItemsError) throw oldItemsError;

    const oldVariantIds = Array.from(
      new Set((oldItems || []).map((item: any) => Number(item.variant_id)).filter((value) => !Number.isNaN(value)))
    );
    const { data: oldIngredients, error: oldIngredientsError } = oldVariantIds.length > 0
      ? await supabaseServer
          .from("tbl_product_ingredients")
          .select("variant_id, ingredient_id, amount")
          .in("variant_id", oldVariantIds)
      : { data: [], error: null };

    if (oldIngredientsError) throw oldIngredientsError;

    const ingredientsByVariant = new Map<number, Array<{ ingredient_id: number; amount: number }>>();
    for (const ingredient of oldIngredients || []) {
      const variantId = Number((ingredient as any).variant_id);
      if (!ingredientsByVariant.has(variantId)) ingredientsByVariant.set(variantId, []);
      ingredientsByVariant.get(variantId)!.push({
        ingredient_id: Number((ingredient as any).ingredient_id),
        amount: Number((ingredient as any).amount) || 0,
      });
    }

    // Restore old ingredients
    for (const oldItem of oldItems || []) {
      const ingredients = ingredientsByVariant.get(Number((oldItem as any).variant_id)) || [];

      for (const ing of ingredients) {
        const amountToRestore = (ing.amount || 0) * oldItem.quantity;
        const { data: inventory } = await supabaseServer
          .from("tbl_inventory")
          .select("quantity")
          .eq("ingredient_id", ing.ingredient_id)
          .single();

        if (inventory) {
          await supabaseServer
            .from("tbl_inventory")
            .update({ quantity: (inventory.quantity || 0) + amountToRestore })
            .eq("ingredient_id", ing.ingredient_id);
        }
      }
    }

    // Update order header
    const { error: updateError } = await supabaseServer
      .from("tbl_orders")
      .update({
        total: Number(total),
        discount_type: discount_type || null,
        discount: discount ? Number(discount) : 0,
        paid: paid ? Number(paid) : Number(total),
        change: change ? Number(change) : 0,
        customer_name: customer_name?.trim() ? customer_name.trim() : "Walk-in",
        notes: notes ? String(notes).trim() : null,
        last_edited_at: new Date().toISOString(),
        edit_reason: edit_reason ? String(edit_reason).trim() : null,
      })
      .eq("id", id);

    if (updateError) throw updateError;

    // Delete old order details
    const { error: deleteError } = await supabaseServer.from("tbl_orders_details").delete().eq("order_id", id);

    if (deleteError) throw deleteError;

    // Insert new order details
    for (const item of items) {
      const { variant_id, quantity, price, discount_type: itemDiscountType, discount: itemDiscount, addOns = [] } = item;

      if (!variant_id || quantity === undefined || price === undefined) {
        return NextResponse.json(
          { message: "Each item must include variant_id, quantity, and price" },
          { status: 400 }
        );
      }

      // Get new ingredients
      const { data: recipeIngredients, error: ingredientError } = await supabaseServer
        .from("tbl_product_ingredients")
        .select("ingredient_id, amount")
        .eq("variant_id", variant_id);

      if (ingredientError) throw ingredientError;

      const newVariantIngredients = await Promise.all(
        (recipeIngredients || []).map(async (recipe: any) => {
          const [{ data: inventory }, { data: ingredient }] = await Promise.all([
            supabaseServer
              .from("tbl_inventory")
              .select("quantity")
              .eq("ingredient_id", recipe.ingredient_id)
              .single(),
            supabaseServer
              .from("tbl_ingredients")
              .select("ingredient_name")
              .eq("id", recipe.ingredient_id)
              .single(),
          ]);

          return {
            ingredient_id: recipe.ingredient_id,
            amount: Number(recipe.amount) || 0,
            inventory_quantity: Number(inventory?.quantity) || 0,
            ingredient_name: ingredient?.ingredient_name || `Ingredient ${recipe.ingredient_id}`,
          };
        })
      );

      // Check ingredient availability
      for (const ing of newVariantIngredients || []) {
        const requiredAmount = (ing.amount || 0) * quantity;
        const available = ing.inventory_quantity;

        if (available < requiredAmount) {
          return NextResponse.json(
            {
              message: `Not enough ${ing.ingredient_name}. Need ${requiredAmount}, only ${available} available`,
            },
            { status: 400 }
          );
        }
      }

      // Check add-on availability
      for (const addOn of addOns) {
        const { data: toppingData } = await supabaseServer
          .from("tbl_toppings")
          .select("id, name, quantity")
          .eq("id", addOn.id)
          .eq("is_deleted", false)
          .single();

        if (!toppingData) {
          return NextResponse.json({ message: `Add-on (ID: ${addOn.id}) not found` }, { status: 400 });
        }

        const requiredQuantity = (addOn.quantity || 1) * quantity;
        const available = Number(toppingData.quantity) || 0;

        if (available < requiredQuantity) {
          return NextResponse.json(
            { message: `Not enough ${toppingData.name}. Need ${requiredQuantity}, only ${available} available` },
            { status: 400 }
          );
        }
      }

      const subtotal = Number(price) * Number(quantity);
      const itemDiscountAmount = itemDiscount ? Number(itemDiscount) : 0;

      // Insert new order detail
      const { error: insertError } = await supabaseServer.from("tbl_orders_details").insert({
        order_id: id,
        variant_id,
        quantity: Number(quantity),
        subtotal,
        discount_type: itemDiscountType || null,
        discount: itemDiscountAmount,
      });

      if (insertError) throw insertError;

      // Deduct new ingredients
      for (const ing of newVariantIngredients || []) {
        const { data: inv } = await supabaseServer
          .from("tbl_inventory")
          .select("quantity")
          .eq("ingredient_id", ing.ingredient_id)
          .single();

        const newQty = (inv?.quantity || 0) - (ing.amount * quantity);

        await supabaseServer
          .from("tbl_inventory")
          .update({ quantity: Math.max(0, newQty) })
          .eq("ingredient_id", ing.ingredient_id);
      }

      // Deduct new add-ons
      for (const addOn of addOns) {
        const requiredQuantity = (addOn.quantity || 1) * quantity;
        const { data: topping } = await supabaseServer
          .from("tbl_toppings")
          .select("quantity")
          .eq("id", addOn.id)
          .single();

        if (topping) {
          await supabaseServer
            .from("tbl_toppings")
            .update({ quantity: Math.max(0, (topping.quantity || 0) - requiredQuantity) })
            .eq("id", addOn.id);
        }
      }
    }

    return NextResponse.json({ message: "Order updated successfully", order_id: id });
  } catch (error: any) {
    console.error("Update order error:", error);
    return NextResponse.json(
      { message: "Cannot update order", error: error.message },
      { status: 500 }
    );
  }
}

// UPDATE ORDER STATUS
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, action, admin_password, customer_name, notes } = body;
    const shopId = req.headers.get("x-shop-id");

    if (action === "edit" || action === "delete") {
      const authorized = await verifyAdmin(admin_password, shopId);
      if (!authorized) {
        return NextResponse.json({ message: "Admin password is incorrect" }, { status: 403 });
      }

      const orderId = Number(id);
      if (!orderId || Number.isNaN(orderId)) {
        return NextResponse.json({ message: "Order ID required" }, { status: 400 });
      }

      if (action === "delete") {
        const { error: detailsError } = await supabaseServer
          .from("tbl_orders_details")
          .delete()
          .eq("order_id", orderId);
        if (detailsError) throw detailsError;

        const { error: deleteError } = await supabaseServer
          .from("tbl_orders")
          .delete()
          .eq("id", orderId)
          .eq("shop_id", Number(shopId));
        if (deleteError) throw deleteError;

        return NextResponse.json({ message: "Order deleted successfully" });
      }

      const { error: editError } = await supabaseServer
        .from("tbl_orders")
        .update({
          customer_name: String(customer_name || "Walk-in").trim() || "Walk-in",
          notes: notes ? String(notes).trim() : null,
        })
        .eq("id", orderId)
        .eq("shop_id", Number(shopId));
      if (editError) throw editError;

      return NextResponse.json({ message: "Order updated successfully" });
    }

    if (!id || !status) {
      return NextResponse.json(
        { message: "Order ID and status required" },
        { status: 400 }
      );
    }

    const nextStatus = String(status);

    const { data: existingOrder, error: orderError } = await supabaseServer
      .from("tbl_orders")
      .select("id, status, accepted_at")
      .eq("id", id)
      .single();

    if (orderError || !existingOrder) {
      return NextResponse.json(
        { message: "Order not found" },
        { status: 404 }
      );
    }

    // Deduct ingredients only once: when transitioning into completed.
    if (existingOrder.status !== "completed" && nextStatus === "completed") {
      const { data: orderDetails, error: detailsError } = await supabaseServer
        .from("tbl_orders_details")
        .select("variant_id, quantity")
        .eq("order_id", id);

      if (detailsError) throw detailsError;

      const detailRows = orderDetails || [];
      const variantIds = Array.from(new Set(detailRows.map((row: any) => Number(row.variant_id)).filter((value) => !Number.isNaN(value))));

      if (variantIds.length > 0) {
        const { data: recipeRows, error: recipeError } = await supabaseServer
          .from("tbl_product_ingredients")
          .select("variant_id, ingredient_id, amount")
          .in("variant_id", variantIds);

        if (recipeError) throw recipeError;

        const recipeByVariant = new Map<number, Array<{ ingredient_id: number; amount: number }>>();
        for (const row of recipeRows || []) {
          const variantId = Number((row as any).variant_id);
          const ingredientId = Number((row as any).ingredient_id);
          const amount = Number((row as any).amount) || 0;

          if (Number.isNaN(variantId) || Number.isNaN(ingredientId) || amount <= 0) continue;
          if (!recipeByVariant.has(variantId)) recipeByVariant.set(variantId, []);
          recipeByVariant.get(variantId)!.push({ ingredient_id: ingredientId, amount });
        }

        const requiredByIngredient = new Map<number, number>();

        for (const detail of detailRows) {
          const variantId = Number((detail as any).variant_id);
          const qty = Number((detail as any).quantity) || 0;
          const ingredients = recipeByVariant.get(variantId) || [];

          for (const ingredient of ingredients) {
            const currentRequired = requiredByIngredient.get(ingredient.ingredient_id) || 0;
            requiredByIngredient.set(ingredient.ingredient_id, currentRequired + ingredient.amount * qty);
          }
        }

        const ingredientIds = Array.from(requiredByIngredient.keys());
        if (ingredientIds.length > 0) {
          const { data: inventoryRows, error: inventoryError } = await supabaseServer
            .from("tbl_inventory")
            .select("ingredient_id, quantity")
            .in("ingredient_id", ingredientIds);

          if (inventoryError) throw inventoryError;

          const inventoryMap = new Map<number, number>(
            (inventoryRows || []).map((row: any) => [Number(row.ingredient_id), Number(row.quantity) || 0])
          );

          for (const ingredientId of ingredientIds) {
            const available = inventoryMap.get(ingredientId) || 0;
            const required = requiredByIngredient.get(ingredientId) || 0;

            if (available < required) {
              return NextResponse.json(
                { message: `Not enough inventory for ingredient ${ingredientId}. Need ${required}, only ${available} available.` },
                { status: 400 }
              );
            }
          }

          for (const ingredientId of ingredientIds) {
            const available = inventoryMap.get(ingredientId) || 0;
            const required = requiredByIngredient.get(ingredientId) || 0;
            const newQuantity = available - required;

            const { error: updateInventoryError } = await supabaseServer
              .from("tbl_inventory")
              .update({ quantity: newQuantity })
              .eq("ingredient_id", ingredientId);

            if (updateInventoryError) throw updateInventoryError;
          }
        }
      }
    }

    const updateValues = {
      status,
      ...(nextStatus === "preparing" && existingOrder.status !== "preparing" && !existingOrder.accepted_at
        ? { accepted_at: new Date().toISOString() }
        : {}),
    };

    const { error } = await supabaseServer.from("tbl_orders").update(updateValues).eq("id", id);

    if (error) throw error;

    return NextResponse.json({ message: "Order status updated successfully", status });
  } catch (error: any) {
    console.error("Update order status error:", error);
    return NextResponse.json(
      { message: "Failed to update order status", error: error.message },
      { status: 500 }
    );
  }
}
