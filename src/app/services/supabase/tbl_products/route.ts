import { NextResponse, NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase";

// -------------------- GET (ALL or SINGLE PRODUCT) --------------------
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const shopId = url.searchParams.get("shop_id");

    if (!shopId) {
      return NextResponse.json({ message: "shop_id is required" }, { status: 400 });
    }

    // ✅ FETCH INVENTORY ONCE ONLY
    const { data: inventory } = await supabaseServer
      .from("tbl_inventory")
      .select("ingredient_id, quantity");

    const invMap = new Map(
      (inventory || []).map((i: any) => [i.ingredient_id, i.quantity])
    );

    // ================= SINGLE PRODUCT =================
    if (id) {
      const { data: product, error } = await supabaseServer
        .from("tbl_products")
        .select(`
          *,
          tbl_product_variants (
            id,
            name,
            price,
            calculated_cost,
            quantity
          )
        `)
        .eq("id", id)
        .eq("shop_id", shopId)
        .eq("is_deleted", 0)
        .maybeSingle();

      if (error || !product) {
        return NextResponse.json(
          { message: "Product not found", error: error?.message },
          { status: 404 }
        );
      }

      const variantsWithStock = await Promise.all(
        (product.tbl_product_variants || []).map(async (v: any) => {
          const { data: recipe } = await supabaseServer
            .from("tbl_product_ingredients")
            .select("ingredient_id, amount")
            .eq("variant_id", v.id);

          let minStock = Infinity;

          for (const r of recipe || []) {
            const stockQty = invMap.get(r.ingredient_id) || 0;
            const possible = r.amount > 0 ? stockQty / r.amount : 0;

            minStock = Math.min(minStock, possible);
          }

          return {
            id: v.id,
            name: v.name,
            price: v.price,
            calculated_cost: v.calculated_cost || 0,
            calculated_stock: Math.floor(minStock === Infinity ? 0 : minStock),
          };
        })
      );

      return NextResponse.json(
        { ...product, tbl_product_variants: variantsWithStock },
        { status: 200 }
      );
    }

    // ================= ALL PRODUCTS =================
    const { data, error } = await supabaseServer
      .from("tbl_products")
      .select(`
        id,
        category_id,
        product_name,
        product_description,
        image,
        is_deleted,
        created_at,
        tbl_product_variants (
          id,
          name,
          price,
          calculated_cost,
          quantity
        )
      `)
      .eq("shop_id", shopId)
      .eq("is_deleted", 0)
      .order("id", { ascending: false });

    if (error) {
      return NextResponse.json(
        { message: "Cannot fetch products", error: error.message },
        { status: 500 }
      );
    }

    const productsWithStock = await Promise.all(
      (data || []).map(async (product: any) => {
        const variantsWithStock = await Promise.all(
          (product.tbl_product_variants || []).map(async (v: any) => {
            const { data: recipe } = await supabaseServer
              .from("tbl_product_ingredients")
              .select("ingredient_id, amount")
              .eq("variant_id", v.id);

            let minStock = Infinity;

            for (const r of recipe || []) {
              const stockQty = invMap.get(r.ingredient_id) || 0;
              const possible = r.amount > 0 ? stockQty / r.amount : 0;

              minStock = Math.min(minStock, possible);
            }

            return {
              id: v.id,
              name: v.name,
              price: v.price,
              calculated_cost: v.calculated_cost || 0,
              calculated_stock: Math.floor(minStock === Infinity ? 0 : minStock),
            };
          })
        );

        return {
          ...product,
          tbl_product_variants: variantsWithStock,
        };
      })
    );

    return NextResponse.json(productsWithStock || [], { status: 200 });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}