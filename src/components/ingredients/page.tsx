"use client";

import { useState, useEffect } from "react";
import { Fetch_to } from "@/utilities";
import api_links from "@/config/fetch_links/api_links.json";
import IngredientForm from "./form";

interface Ingredient {
  id: number;
  ingredient_name: string;
  unit: string;
  unit_price: number | null;
  quantity: number | null;
}

interface IngredientsPageProps {
  shopId?: string;
}

export default function IngredientsPage({ shopId = "1" }: IngredientsPageProps) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit" | "delete">("create");
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | undefined>();

  const fetchIngredients = async () => {
    try {
      setLoading(true);
      const response = await Fetch_to(
        `${api_links.tbl_ingredients}?shop_id=${shopId}`,
        {},
        {},
        3,
        1000,
        "GET"
      );

      if (response.success && Array.isArray(response.data)) {
        setIngredients(response.data);
      }
    } catch (error) {
      console.error("Error fetching ingredients:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIngredients();
  }, [shopId]);

  const handleCreateClick = () => {
    setFormMode("create");
    setSelectedIngredient(undefined);
    setShowForm(true);
  };

  const handleEditClick = (ingredient: Ingredient) => {
    setFormMode("edit");
    setSelectedIngredient(ingredient);
    setShowForm(true);
  };

  const handleDeleteClick = (ingredient: Ingredient) => {
    setFormMode("delete");
    setSelectedIngredient(ingredient);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setSelectedIngredient(undefined);
    fetchIngredients();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setSelectedIngredient(undefined);
  };

  const filteredIngredients = ingredients.filter((ing) =>
    ing.ingredient_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#073dbe] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading ingredients...</p>
        </div>
      </div>
    );
  }

  // Delete confirmation dialog
  // Add/Edit form
  if (showForm) {
    return (
      <>
        <IngredientForm
          mode={formMode}
          shopId={shopId}
          ingredient={selectedIngredient}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {showForm && (
        <IngredientForm
          mode={formMode}
          shopId={shopId}
          ingredient={selectedIngredient}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">
              Ingredient Management
            </h1>
            <p className="text-slate-600 mt-1 text-sm">
              Manage your ingredients and inventory ({ingredients.length} total)
            </p>
          </div>
          <button
            onClick={handleCreateClick}
            className="bg-[#073dbe] hover:bg-[#052d99] text-white px-5 py-2.5 rounded-lg transition-all font-medium flex items-center justify-center gap-2 text-sm"
          >
            Add Ingredient
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg border border-slate-200 p-3 mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search ingredients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:border-[#073dbe] focus:ring-2 focus:ring-blue-100 transition-all outline-none text-sm"
          />
        </div>
      </div>

      {/* Ingredients Table */}
      {filteredIngredients.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <h3 className="text-lg font-bold text-slate-900 mb-2">No Ingredients Found</h3>
          <p className="text-slate-600 text-sm mb-6">
            {searchQuery
              ? "Try adjusting your search"
              : "Start by adding your first ingredient"}
          </p>
          <button
            onClick={handleCreateClick}
            className="inline-flex items-center gap-2 bg-[#073dbe] hover:bg-[#052d99] text-white px-5 py-2.5 rounded-lg transition-all font-medium text-sm"
          >
            Add Ingredient
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Ingredient
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Unit
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Unit Price
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredIngredients.map((ingredient) => (
                  <tr
                    key={ingredient.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {ingredient.ingredient_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {ingredient.unit}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {ingredient.quantity !== null ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                            ingredient.quantity < 10
                              ? "bg-red-100 text-red-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {ingredient.quantity}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Unknown</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {ingredient.unit_price !== null
                        ? `₱${Number(ingredient.unit_price).toFixed(2)}`
                        : "-"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditClick(ingredient)}
                          className="px-3 py-1.5 bg-[#073dbe] hover:bg-[#052d99] text-white rounded-lg transition-all font-medium text-xs"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteClick(ingredient)}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all font-medium text-xs"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
