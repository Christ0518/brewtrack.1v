import { useState, useEffect } from "react";
import { Fetch_to } from "@/utilities";
import api_links from "@/config/fetch_links/api_links.json";
import { Product } from "@/types/products";

interface ProductFormProps {
  mode: "create" | "edit" | "delete";
  shopId: string;
  product?: Product;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function ProductForm({
  mode,
  shopId,
  product,
  onSuccess,
  onCancel
}: ProductFormProps) {

  const [form, setForm] = useState<Product>(
    product || {
      category_id: "",
      product_name: "",
      product_description: "",
      variants: []
    }
  );

  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // LOAD DATA
  useEffect(() => {
    const load = async () => {
      try {
        const res = await Fetch_to(
          `${api_links.tbl_category}?shop_id=${shopId}`,
          {},
          {},
          3,
          1000,
          "GET"
        );
        if (res.success) setCategories(res.data || []);
      } catch (err) {
        console.error(err);
      }
    };

    load();
  }, [shopId]);

  // LOAD PRODUCT
  useEffect(() => {
    if (mode === "edit" && product) {
      setForm(product);
    }
  }, [mode, product]);

  const handleInputChange = (field: keyof Product, value: any) => {
    setForm({ ...form, [field]: value });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    setError("");
    setLoading(true);

    try {
      // ❗ IMPORTANT: Skip validation when deleting
      if (mode !== "delete" && (!form.category_id || !form.product_name)) {
        throw new Error("Category and Product Name are required");
      }

      let endpoint = "";
      let method = "POST";

      if (mode === "create") {
        endpoint = api_links.tbl_products;
        method = "POST";
      } else if (mode === "edit") {
        endpoint = `${api_links.tbl_products}?id=${form.id}`;
        method = "PUT";
      } else {
        endpoint = `${api_links.tbl_products}?id=${form.id}&shop_id=${shopId}`;
        method = "DELETE";
      }

     const res = await Fetch_to(endpoint, form as unknown as Record<string, unknown>, {}, 3, 1000, method);

      if (!res.success) throw new Error(res.message);

      alert(
        `Product ${
          mode === "delete"
            ? "deleted"
            : mode === "edit"
            ? "updated"
            : "added"
        } successfully`
      );

      onSuccess?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">

      <div className="max-w-3xl mx-auto bg-white p-6 rounded shadow">

        <h1 className="text-xl font-bold mb-4">
          {mode === "edit" ? "Edit Product" : "Add Product"}
        </h1>

        {error && (
          <div className="bg-red-100 text-red-600 p-2 mb-4 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          <select
            value={form.category_id}
            onChange={(e) =>
              handleInputChange("category_id", e.target.value)
            }
            className="w-full border p-2"
          >
            <option value="">Select Category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={form.product_name}
            onChange={(e) =>
              handleInputChange("product_name", e.target.value)
            }
            placeholder="Product name"
            className="w-full border p-2"
          />

          <textarea
            value={form.product_description}
            onChange={(e) =>
              handleInputChange("product_description", e.target.value)
            }
            placeholder="Description"
            className="w-full border p-2"
          />

          {/* BUTTONS */}
          <div className="flex gap-2">

            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded"
              disabled={loading}
            >
              {loading ? "Saving..." : "Save"}
            </button>

            {/* ✅ FIX: ADD THIS BUTTON */}
            {mode === "edit" && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-red-600 text-white px-4 py-2 rounded"
              >
                Delete
              </button>
            )}

            <button
              type="button"
              onClick={onCancel}
              className="bg-gray-300 px-4 py-2 rounded"
            >
              Cancel
            </button>

          </div>
        </form>
      </div>

      {/* ✅ DELETE MODAL (OUTSIDE FORM) */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">

          <div className="bg-white p-6 rounded shadow w-80">

            <h2 className="font-bold mb-2">Delete Product</h2>

            <p className="text-sm mb-4">
              Are you sure you want to delete "{form.product_name}"?
            </p>

            <div className="flex gap-2">

              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-gray-200 p-2 rounded"
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  handleSubmit();
                }}
                className="flex-1 bg-red-600 text-white p-2 rounded"
              >
                {loading ? "Deleting..." : "Delete"}
              </button>

            </div>

          </div>
        </div>
      )}
    </div>
  );
}