# Frontend Integration Guide - Stock Management

## Quick Start

### 1. Displaying Products with Real-Time Stock

```typescript
// src/components/products/index.tsx
import { useEffect, useState } from "react";
import { calculateVariantStock } from "@/lib/stock";

export function ProductList({ shopId }) {
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    const loadProducts = async () => {
      const res = await fetch(`/services/supabase/tbl_products_v2?shop_id=${shopId}`);
      const data = await res.json();
      setProducts(data);
    };
    loadProducts();
  }, [shopId]);

  return (
    <div className="grid gap-4">
      {products.map((product) => (
        <div key={product.id}>
          <h3>{product.product_name}</h3>
          <div className="space-y-2">
            {product.variants?.map((variant) => (
              <ProductVariantCard
                key={variant.id}
                variant={variant}
                shopId={shopId}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductVariantCard({ variant, shopId }) {
  return (
    <div className="border p-3 rounded">
      <div className="flex justify-between items-center">
        <div>
          <p className="font-medium">{variant.name}</p>
          <p className="text-slate-600">${variant.price}</p>
        </div>
        
        {/* Show calculated_stock */}
        <div className="text-right">
          {variant.calculated_stock > 0 ? (
            <span className="text-green-600 font-medium">
              ✓ In Stock ({variant.calculated_stock})
            </span>
          ) : (
            <span className="text-red-600 font-medium">
              ✕ OUT OF STOCK
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 2. Cashier Component - Use calculated_stock

```typescript
// src/components/cashier/index.tsx
// BEFORE (WRONG) ❌
{variant.quantity > 0 ? "In Stock" : "OUT OF STOCK"}

// AFTER (CORRECT) ✅
{variant.calculated_stock > 0 ? "In Stock" : "OUT OF STOCK"}
```

**Full Example:**
```typescript
export function Cashier() {
  const [cart, setCart] = useState<CartItem[]>([]);

  const handleAddToCart = (variant: any) => {
    // Check calculated_stock (from API response)
    if (variant.calculated_stock <= 0) {
      alert("Product is out of stock!");
      return;
    }

    setCart([...cart, { variant_id: variant.id, quantity: 1, price: variant.price }]);
  };

  return (
    <div className="grid gap-4">
      {products.map((product) =>
        product.variants?.map((variant) => (
          <button
            key={variant.id}
            onClick={() => handleAddToCart(variant)}
            disabled={variant.calculated_stock <= 0}
            className={`p-4 border rounded ${
              variant.calculated_stock > 0
                ? "hover:bg-blue-50 cursor-pointer"
                : "bg-red-50 text-red-600 cursor-not-allowed opacity-60"
            }`}
          >
            <p>{variant.name}</p>
            <p className="text-sm text-slate-600">
              {variant.calculated_stock > 0
                ? `Available: ${variant.calculated_stock}`
                : "OUT OF STOCK"}
            </p>
          </button>
        ))
      )}
    </div>
  );
}
```

---

## 3. Checkout with Inventory Deduction

```typescript
// src/components/checkout/index.tsx
async function handleCheckout(cartItems: CartItem[]) {
  try {
    const response = await fetch("/services/supabase/tbl_orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-shop-id": shopId
      },
      body: JSON.stringify({
        cashier_id: currentCashier.id,
        order_type: orderType,
        total: cartTotal,
        items: cartItems,
        discount: appliedDiscount,
        customer_name: customerName || "Walk-in",
        notes: specialNotes
      })
    });

    const result = await response.json();

    if (!result.success) {
      // Specific error - likely stock issue
      showError(result.message);
      return;
    }

    // Success - inventory has been deducted
    showSuccess(`Order #${result.order_id} completed`);
    
    // Log deductions (optional)
    console.log("Inventory deducted:", result.inventory_deductions);

    // Clear cart and refresh products
    setCart([]);
    loadProducts();

  } catch (error) {
    showError("Failed to process order");
  }
}
```

---

## 4. Real-Time Stock Updates

For live updates, recalculate stock after order:

```typescript
// Option A: Refresh products after order
async function refreshStock() {
  const res = await fetch(`/services/supabase/tbl_products_v2?shop_id=${shopId}`);
  const products = await res.json();
  setProducts(products);
}

// Option B: Manual recalculation
async function recalculateVariantStock(variantId: number) {
  const { data } = await supabaseServer
    .from("tbl_product_variants")
    .select("id")
    .eq("id", variantId)
    .single();

  if (data) {
    const stock = await calculateVariantStock(variantId, shopId);
    // Update UI
    setVariantStock(prev => ({ ...prev, [variantId]: stock }));
  }
}
```

---

## 5. Error Handling Examples

```typescript
async function addToCart(variant: any) {
  // Check stock before adding
  if (variant.calculated_stock < 1) {
    toast.error(`${variant.name} is out of stock`);
    return;
  }

  setCart([...cart, { variant_id: variant.id, quantity: 1 }]);
  toast.success(`Added ${variant.name} to cart`);
}

async function checkout() {
  if (cart.length === 0) {
    toast.error("Cart is empty");
    return;
  }

  const response = await fetch("/services/supabase/tbl_orders", {
    method: "POST",
    body: JSON.stringify({ ...orderData })
  });

  const { success, message } = await response.json();

  if (!success) {
    // Handle specific errors
    if (message.includes("Insufficient")) {
      toast.error("Some items are no longer in stock: " + message);
    } else {
      toast.error(message);
    }
    return;
  }

  toast.success("Order placed successfully!");
}
```

---

## 6. Admin Dashboard - Stock Breakdown

```typescript
// src/components/admin/VariantStockBreakdown.tsx
import { getVariantStockBreakdown } from "@/lib/stock";

export function StockBreakdown({ variantId, shopId }) {
  const [breakdown, setBreakdown] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      const data = await getVariantStockBreakdown(variantId, shopId);
      setBreakdown(data);
    };
    load();
  }, [variantId, shopId]);

  if (!breakdown) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <h3 className="font-bold">Stock Breakdown</h3>
      
      <div className="space-y-2">
        {breakdown.breakdown.map((item: any) => (
          <div key={item.ingredient_id} className="border p-3 rounded">
            <p className="font-medium">{item.ingredient_name} ({item.unit})</p>
            <div className="text-sm text-slate-600">
              <p>Current Stock: {item.current_stock}</p>
              <p>Needed per Unit: {item.amount_needed_per_unit}</p>
              <p className="text-blue-600 font-medium">
                Can Make: {item.possible_units} units
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 p-3 rounded">
        <p className="text-sm">
          <strong>Final Available Stock:</strong>{" "}
          <span className="text-xl font-bold text-blue-600">
            {breakdown.final_stock} units
          </span>
        </p>
        <p className="text-xs text-slate-600 mt-1">
          Limited by: {breakdown.breakdown[0]?.ingredient_name}
        </p>
      </div>
    </div>
  );
}
```

---

## 7. Update Your Add/Edit Product Forms

```typescript
// src/components/products/partial/add.tsx
// When saving a variant, link ingredients:

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  const response = await fetch("/services/supabase/tbl_products_v2", {
    method: "POST",
    body: JSON.stringify({
      category_id: form.category_id,
      product_name: form.product_name,
      product_description: form.product_description,
      variants: form.variants.map((v) => ({
        name: v.name,
        price: v.price,
        calculated_cost: v.calculated_cost,
        ingredients: v.ingredients // This links to tbl_product_ingredients
      }))
    })
  });

  // Note: quantity field is ignored in API
  // Stock is calculated from ingredients + inventory
};
```

---

## 8. API Response Structure

**What your components receive:**
```json
{
  "id": 1,
  "product_name": "Espresso",
  "variants": [
    {
      "id": 10,
      "name": "Medium",
      "price": 3.50,
      "quantity": 0,
      "calculated_cost": 1.20,
      "calculated_stock": 45
    }
  ]
}
```

**Use:**
- `calculated_stock` → For display and checkout validation
- `quantity` → Ignore (deprecated)
- `price` → Variant price
- `calculated_cost` → Cost for analytics

---

## 9. Key Files to Update

1. **Cashier Component**
   - Replace `variant.quantity` with `variant.calculated_stock`
   - Check stock before adding to cart

2. **Product Display**
   - Use `calculated_stock` for "In Stock" labels
   - Disable "Add to Cart" if `calculated_stock === 0`

3. **Checkout**
   - Use `/services/supabase/tbl_orders` POST endpoint
   - Handle error messages for insufficient stock

4. **Admin Dashboard**
   - Show breakdown of why stock is low
   - Display limiting ingredient

---

## Testing Checklist

- [ ] Add product with ingredients linked
- [ ] Check API returns `calculated_stock`
- [ ] Add items to cart with in-stock products
- [ ] Try adding out-of-stock product (should fail)
- [ ] Place order - should deduct inventory
- [ ] Check inventory in DB after order
- [ ] Stock should decrease in UI after refresh
- [ ] Try checking out with insufficient stock (should show error)

---

## Common Issues

| Issue | Solution |
|-------|----------|
| Stock always shows 0 | Ingredients not linked to variant |
| Stock not decreasing | Order endpoint not being called, or ingredients not linked |
| Can add out-of-stock item | Frontend not checking `calculated_stock` |
| Negative inventory | Check deductOrderInventory validation |
