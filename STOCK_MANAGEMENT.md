# Stock Management System Architecture

## Overview
Real-time inventory management using recipe-based stock calculation. Stock is computed from ingredient availability, not stored as static quantities.

---

## 1. Core Concepts

### Stock Calculation Formula
```
Product Stock = MIN(available_inventory[ingredient_i] / recipe[ingredient_i])

For each ingredient in a variant's recipe:
  batch_count = current_inventory / amount_needed
Find the minimum batch_count → that's available stock
```

**Example:**
- Variant: "Medium Espresso"
- Recipe:
  - Coffee Beans: 30g per unit
  - Milk: 10ml per unit
- Inventory:
  - Coffee Beans: 600g → 600/30 = 20 batches
  - Milk: 300ml → 300/10 = 30 batches
- **Stock = MIN(20, 30) = 20 units available**

---

## 2. Database Schema

### Core Tables

**tbl_products**
```sql
id, product_name, product_description, category_id, shop_id, is_deleted
```

**tbl_product_variants**
```sql
id, product_id, name, price, quantity (DEPRECATED ❌), calculated_cost, is_deleted
```
⚠️ `quantity` field is **ignored** - use `calculated_stock` from computation

**tbl_product_ingredients** (The Recipe)
```sql
id, variant_id, ingredient_id, amount (how much per unit)
```

**tbl_ingredients**
```sql
id, ingredient_name, unit (kg, g, ml, etc), unit_price, shop_id, is_deleted
```

**tbl_inventory** (Source of Truth)
```sql
ingredient_id, quantity (current stock level)
```

**tbl_orders**
```sql
id, cashier_id, order_type, total, discount, shop_id, status, created_at
```

**tbl_orders_details**
```sql
id, order_id, variant_id, quantity, subtotal, discount
```

---

## 3. Stock Calculation Function

**Location:** `src/lib/stock.ts`

### Main Function: `calculateVariantStock(variantId, shopId)`

```typescript
async function calculateVariantStock(variantId, shopId): Promise<number>
```

**Logic:**
1. Fetch recipe from `tbl_product_ingredients` (what ingredients needed)
2. Fetch current inventory from `tbl_inventory` (how much available)
3. For each ingredient: `available_batches = stock / amount_needed`
4. Return minimum of all batches (bottleneck ingredient)
5. Return 0 if any ingredient is out of stock

**Usage in API:**
```typescript
// In GET /services/supabase/tbl_products
const variantsWithStock = await Promise.all(
  variants.map(async (v) => ({
    ...v,
    calculated_stock: await calculateVariantStock(v.id, shopId)
  }))
);
```

**Frontend Usage:**
```typescript
// CORRECT ✅
if (variant.calculated_stock > 0) {
  // In stock
}

// WRONG ❌
if (variant.quantity > 0) {
  // Don't use this - deprecated
}
```

---

## 4. Inventory Deduction (Checkout Flow)

### Function: `deductOrderInventory(cartItems, shopId)`

**Input:**
```typescript
cartItems = [
  { variant_id: 1, quantity: 2 },
  { variant_id: 3, quantity: 1 }
]
```

**Process:**
1. For each cart item:
   - Fetch its recipe from `tbl_product_ingredients`
   - Calculate total ingredient usage: `recipe_amount × order_quantity`
   - Accumulate total for each ingredient
2. **Verify** sufficient stock exists for ALL ingredients
3. If insufficient → Reject order with clear message
4. **Deduct** all at once (atomic operation)
5. Return deduction summary

**Example Deduction:**
```
Cart: 2x Medium Espresso, 1x Large Cappuccino

Medium Espresso Recipe:
  Coffee: 30g, Milk: 10ml

Large Cappuccino Recipe:
  Coffee: 40g, Milk: 80ml

Total Deduction:
  Coffee: (30 × 2) + (40 × 1) = 100g
  Milk: (10 × 2) + (80 × 1) = 100ml
```

**Response:**
```json
{
  "success": true,
  "message": "Inventory deducted successfully",
  "deducted": [
    { "ingredient_id": 5, "amount": 100 },
    { "ingredient_id": 7, "amount": 100 }
  ]
}
```

---

## 5. API Endpoints

### Products with Calculated Stock
**GET `/services/supabase/tbl_products_v2?shop_id=1`**

```json
{
  "id": 1,
  "product_name": "Espresso",
  "variants": [
    {
      "id": 10,
      "name": "Medium",
      "price": 3.50,
      "calculated_stock": 45,
      "quantity": 0  // DEPRECATED, ignore this
    }
  ]
}
```

### Place Order & Deduct Inventory
**POST `/services/supabase/tbl_orders`**

```json
{
  "shop_id": "1",
  "cashier_id": 5,
  "order_type": "dine-in",
  "total": 15.50,
  "items": [
    { "variant_id": 10, "quantity": 2, "price": 3.50 },
    { "variant_id": 15, "quantity": 1, "price": 8.50 }
  ],
  "discount": 0,
  "notes": "Extra hot"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Order created and inventory deducted",
  "order_id": 42,
  "inventory_deductions": [
    { "ingredient_id": 5, "amount": 100 },
    { "ingredient_id": 7, "amount": 120 }
  ]
}
```

**Response (Insufficient Stock):**
```json
{
  "success": false,
  "message": "Insufficient stock for ingredient ID 5. Have 50, need 100"
}
```

---

## 6. Frontend Integration

### Display Stock Status
```typescript
import { calculateVariantStock } from "@/lib/stock";

export function ProductCard({ variant, shopId }) {
  const [stock, setStock] = useState(0);

  useEffect(() => {
    const getStock = async () => {
      const available = await calculateVariantStock(variant.id, shopId);
      setStock(available);
    };
    getStock();
  }, [variant.id, shopId]);

  return (
    <div>
      <h3>{variant.name}</h3>
      <p>Price: ${variant.price}</p>
      
      {stock > 0 ? (
        <span className="text-green-600">In Stock ({stock} available)</span>
      ) : (
        <span className="text-red-600">OUT OF STOCK</span>
      )}
    </div>
  );
}
```

### Checkout Process
```typescript
async function handleCheckout(cartItems) {
  const response = await fetch("/services/supabase/tbl_orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      shop_id: "1",
      cashier_id: 5,
      order_type: "dine-in",
      total: cartTotal,
      items: cartItems.map(item => ({
        variant_id: item.id,
        quantity: item.quantity,
        price: item.price
      })),
      discount: orderDiscount
    })
  });

  const result = await response.json();

  if (!result.success) {
    // Show error with specific ingredient issue
    showError(result.message);
    return;
  }

  // Order successful, inventory deducted
  showSuccess(`Order #${result.order_id} created`);
  clearCart();
}
```

---

## 7. Business Rules & Validations

### ✅ What Works

| Scenario | Behavior |
|----------|----------|
| Stock available | Order proceeds, inventory deducted |
| Multiple shops | Each shop has separate inventory |
| Recipe changes | Stock recalculated based on new recipe |
| Zero inventory | Product shows as OUT OF STOCK |
| Partial cart | If 1 item out of stock, entire order rejected |

### 🚫 Prevention Rules

```typescript
// Prevent negative inventory
if (currentStock < requiredAmount) {
  return { success: false, message: "Insufficient stock" };
}

// Prevent direct quantity editing
// variant.quantity is IGNORED in calculations

// Ensure atomic deduction
// All ingredients deducted together, or none at all
```

---

## 8. Performance Optimizations

### Batch Calculations
```typescript
// Instead of calculating per variant
for (const variant of variants) {
  const stock = await calculateVariantStock(variant.id, shopId);
}

// Use parallel calculation
const stocks = await Promise.all(
  variants.map(v => calculateVariantStock(v.id, shopId))
);
```

### Caching Strategy (Optional)
```typescript
// Cache stock for 5 seconds per variant
const stockCache = new Map();

async function getCachedStock(variantId, shopId) {
  const key = `${variantId}_${shopId}`;
  const cached = stockCache.get(key);
  
  if (cached && Date.now() - cached.time < 5000) {
    return cached.value;
  }

  const stock = await calculateVariantStock(variantId, shopId);
  stockCache.set(key, { value: stock, time: Date.now() });
  return stock;
}
```

### Query Optimization
Pre-fetch all variants' ingredients in one query:
```typescript
const { data: allRecipes } = await supabaseServer
  .from("tbl_product_ingredients")
  .select("variant_id, ingredient_id, amount")
  .in("variant_id", variantIds);
```

---

## 9. Migration Path

If you have existing data:

```sql
-- No schema changes needed - tbl_inventory already exists
-- Just stop relying on variant.quantity

-- Optional: Set all variant.quantity to 0 (deprecated)
UPDATE tbl_product_variants SET quantity = 0;

-- Add a flag if tracking recipe changes
-- ALTER TABLE tbl_product_variants ADD COLUMN uses_recipe BOOLEAN DEFAULT true;
```

---

## 10. Troubleshooting

### Stock Shows 0 But Should Be Available
**Check:**
1. Are ingredients linked in `tbl_product_ingredients`?
2. Is inventory recorded in `tbl_inventory`?
3. Are amounts correctly set in recipe?

```sql
-- Debug query
SELECT 
  pv.id as variant_id,
  pv.name,
  pi.ingredient_id,
  pi.amount as needed_per_unit,
  i.quantity as current_stock,
  FLOOR(i.quantity / pi.amount) as possible_units
FROM tbl_product_variants pv
LEFT JOIN tbl_product_ingredients pi ON pv.id = pi.variant_id
LEFT JOIN tbl_inventory i ON pi.ingredient_id = i.ingredient_id
WHERE pv.id = 10;
```

### Orders Not Deducting Inventory
**Check:**
1. Is `deductOrderInventory` being called?
2. Are variant IDs correct?
3. Check `/services/supabase/tbl_orders` response for error message

### Negative Inventory
**Prevent with:**
```typescript
if (currentStock < requiredAmount) {
  throw new Error("Insufficient stock");
}
```

---

## Summary

| Component | Purpose | Location |
|-----------|---------|----------|
| `calculateVariantStock()` | Real-time stock from recipes | `src/lib/stock.ts` |
| `deductOrderInventory()` | Atomic inventory deduction | `src/lib/stock.ts` |
| `tbl_product_ingredients` | Product recipes | Database |
| `tbl_inventory` | Source of truth for stock | Database |
| `/tbl_products_v2` | API with calculated_stock | Route |
| `/tbl_orders` | Checkout & deduction | Route |

**Key Takeaway:** Stock is computed from `tbl_inventory` + `tbl_product_ingredients` recipe, never stored in `variant.quantity`.
