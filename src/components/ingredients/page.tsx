"use client";

import { useState, useEffect } from "react";
import { Fetch_to } from "@/utilities";
import api_links from "@/config/fetch_links/api_links.json";
import IngredientForm from "./form";
import {
  FiAlertCircle,
  FiEdit,
  FiPackage,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiCheckCircle,
  FiX,
} from "react-icons/fi";

interface Ingredient {
  id: number;
  ingredient_name: string;
  unit: string;
  unit_price: number | null;
  quantity: number | null;
}

interface AddOn {
  id: number | string;
  name: string;
  quantity: number | null;
  unit: string;
  price: number | null;
  unit_price: number | null;
  quantity_per_item: number | null;
}

interface IngredientsPageProps {
  shopId?: string;
}

export default function IngredientsPage({ shopId = "1" }: IngredientsPageProps) {
  const isShopTwo = shopId === "2";
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [addonSearchQuery, setAddonSearchQuery] = useState("");
  const [filterStock, setFilterStock] = useState("all");
  const [loading, setLoading] = useState(true);
  const [addOnLoading, setAddOnLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit" | "delete">("create");
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | undefined>();
  const [showAddOnModal, setShowAddOnModal] = useState(false);
  const [submittingAddOn, setSubmittingAddOn] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; id: number | string | null; name: string; isAddOn: boolean }>({
    show: false,
    id: null,
    name: "",
    isAddOn: false,
  });
  const [addOnForm, setAddOnForm] = useState({
    name: "",
    quantity: "",
    unit: "ml",
    unit_price: "",
    price: "",
    quantity_per_item: "1",
  });

  const getLowStockThreshold = (unit: string) => {
    if (unit === "pcs" || unit === "box") return 20;
    if (unit === "ml") return 3000;
    if (unit === "g") return 500;
    if (unit === "L") return 3;
    if (unit === "kg") return 0.5;
    return 100;
  };

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

  const fetchAddOns = async () => {
    try {
      setAddOnLoading(true);
      const response = await Fetch_to(
        api_links.tbl_toppings,
        {},
        {},
        3,
        1000,
        "GET"
      );

      if (response.success && Array.isArray(response.data)) {
        setAddOns(response.data as AddOn[]);
      }
    } catch (error) {
      console.error("Error fetching add-ons:", error);
    } finally {
      setAddOnLoading(false);
    }
  };

  useEffect(() => {
    fetchIngredients();
    fetchAddOns();
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

  const openDeleteModal = (id: number | string, name: string, isAddOn = false) => {
    setDeleteModal({ show: true, id, name, isAddOn });
  };

  const closeDeleteModal = () => {
    setDeleteModal({ show: false, id: null, name: "", isAddOn: false });
  };

  const openAddOnModal = () => {
    setShowAddOnModal(true);
  };

  const closeAddOnModal = () => {
    setShowAddOnModal(false);
    setAddOnForm({
      name: "",
      quantity: "",
      unit: "ml",
      unit_price: "",
      price: "",
      quantity_per_item: "1",
    });
  };

  const handleAddOnChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setAddOnForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmitAddOn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!addOnForm.name || !addOnForm.quantity || !addOnForm.unit_price || !addOnForm.price) {
      return;
    }

    try {
      setSubmittingAddOn(true);
      const response = await Fetch_to(
        api_links.tbl_toppings,
        {
          name: addOnForm.name,
          quantity: Number(addOnForm.quantity),
          unit: addOnForm.unit,
          unit_price: Number(addOnForm.unit_price),
          price: Number(addOnForm.price),
          quantity_per_item: Number(addOnForm.quantity_per_item) || 1,
        },
        {},
        3,
        1000,
        "POST"
      );

      if (response.success) {
        closeAddOnModal();
        await fetchAddOns();
      }
    } catch (error) {
      console.error("Failed to create add-on:", error);
    } finally {
      setSubmittingAddOn(false);
    }
  };

  const handleDelete = async () => {
    try {
      if (!deleteModal.id) return;

      if (deleteModal.isAddOn) {
        await Fetch_to(
          api_links.tbl_toppings,
          { id: deleteModal.id },
          {},
          3,
          1000,
          "DELETE"
        );
        await fetchAddOns();
      } else {
        await Fetch_to(
          `${api_links.tbl_ingredients}?shop_id=${shopId}&id=${deleteModal.id}`,
          {},
          {},
          3,
          1000,
          "DELETE"
        );
        await fetchIngredients();
      }

      closeDeleteModal();
    } catch (error) {
      console.error("Failed to delete item:", error);
      closeDeleteModal();
    }
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
  ).filter((ing) => {
    const threshold = getLowStockThreshold(ing.unit);
    const quantity = Number(ing.quantity) || 0;

    if (filterStock === "low") return quantity < threshold;
    if (filterStock === "normal") return quantity >= threshold;
    return true;
  });

  const lowStockCount = ingredients.filter((ing) => {
    const threshold = getLowStockThreshold(ing.unit);
    return (Number(ing.quantity) || 0) < threshold;
  }).length;

  const totalInventoryValue = ingredients.reduce((sum, ing) => {
    const qty = Number(ing.quantity) || 0;
    const price = Number(ing.unit_price) || 0;
    return sum + qty * price;
  }, 0);

  const filteredAddOns = addOns.filter((addon) =>
    addon.name.toLowerCase().includes(addonSearchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-700 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 flex items-center gap-3">
                <div className={`${isShopTwo ? "bg-yellow-500" : "bg-blue-700"} p-2.5 rounded-lg`}>
                  <span className="text-white text-xl inline-flex">
                    <FiPackage />
                  </span>
                </div>
                Ingredient Management
              </h1>
              <p className="text-slate-600 mt-1 text-sm">
                Track and manage your inventory ({ingredients.length} total)
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
              <button
                onClick={handleCreateClick}
                className={`${isShopTwo ? "bg-yellow-500 hover:bg-yellow-600 text-slate-900" : "bg-blue-700 hover:bg-blue-800 text-white"} px-5 py-2.5 rounded-lg transition-all font-medium flex items-center justify-center gap-2 text-sm`}
              >
                <FiPlus size={18} />
                Add Ingredient
              </button>
              <button
                onClick={openAddOnModal}
                className={`${isShopTwo ? "bg-yellow-500 hover:bg-yellow-600 text-slate-900" : "bg-blue-700 hover:bg-blue-800 text-white"} px-5 py-2.5 rounded-lg transition-all font-medium flex items-center justify-center gap-2 text-sm`}
              >
                <FiPlus size={18} />
                Add Add-On
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className={`${isShopTwo ? "bg-yellow-100" : "bg-blue-50"} p-2.5 rounded-lg`}>
                <span className={isShopTwo ? "text-yellow-700" : "text-blue-700"} style={{ display: "inline-flex" }}>
                  <FiPackage size={20} />
                </span>
              </div>
            </div>
            <div className="text-xs font-semibold text-slate-600 uppercase mb-1">Total Ingredients</div>
            <div className="text-2xl font-bold text-slate-900">{ingredients.length}</div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-green-50 p-2.5 rounded-lg">
                <span className="text-green-600" style={{ display: "inline-flex" }}>
                  <FiCheckCircle size={20} />
                </span>
              </div>
            </div>
            <div className="text-xs font-semibold text-slate-600 uppercase mb-1">Normal Stock</div>
            <div className="text-2xl font-bold text-slate-900">
              {ingredients.filter((ing) => (Number(ing.quantity) || 0) >= getLowStockThreshold(ing.unit)).length}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-red-50 p-2.5 rounded-lg">
                <span className="text-red-600" style={{ display: "inline-flex" }}>
                  <FiAlertCircle size={20} />
                </span>
              </div>
            </div>
            <div className="text-xs font-semibold text-slate-600 uppercase mb-1">Low Stock Alert</div>
            <div className="text-2xl font-bold text-slate-900">{lowStockCount}</div>
          </div>

          
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-3 mb-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 inline-flex">
                <FiSearch size={18} />
              </span>
              <input
                type="text"
                placeholder="Search ingredients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 ${isShopTwo ? "focus:border-yellow-500 focus:ring-yellow-100" : "focus:border-blue-700 focus:ring-blue-100"} transition-all outline-none text-sm`}
              />
            </div>

            <div className="lg:w-48">
              <select
                value={filterStock}
                onChange={(e) => setFilterStock(e.target.value)}
                className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 ${isShopTwo ? "focus:border-yellow-500 focus:ring-yellow-100" : "focus:border-blue-700 focus:ring-blue-100"} transition-all outline-none cursor-pointer text-sm bg-white`}
              >
                <option value="all">All Stock</option>
                <option value="low">Low Stock</option>
                <option value="normal">Normal Stock</option>
              </select>
            </div>
          </div>

          <div className="mt-3 text-sm text-slate-600">
            <span className={`font-semibold ${isShopTwo ? "text-yellow-700" : "text-blue-700"}`}>{filteredIngredients.length}</span>{" "}
            {filteredIngredients.length === 1 ? "ingredient" : "ingredients"} found
          </div>
        </div>

        {lowStockCount > 0 && filterStock !== "low" && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3">
              <span className="text-red-600 text-xl flex-shrink-0 inline-flex">
                <FiAlertCircle />
              </span>
              <div className="flex-1">
                <h4 className="font-bold text-red-800 mb-2 text-sm">Low Stock Alert</h4>
                <div className="text-sm text-red-700 space-y-1 mb-3">
                  <p>
                    {lowStockCount} ingredient{lowStockCount !== 1 ? "s" : ""} need
                    {lowStockCount === 1 ? "s" : ""} to be restocked:
                  </p>
                  <ul className="text-xs ml-4">
                    {ingredients
                      .filter((item) => (Number(item.quantity) || 0) < getLowStockThreshold(item.unit))
                      .slice(0, 5)
                      .map((item) => {
                        const threshold = getLowStockThreshold(item.unit);
                        return (
                          <li key={item.id}>
                            • {item.ingredient_name}: {Number(item.quantity)} {item.unit} (threshold: {threshold} {item.unit})
                          </li>
                        );
                      })}
                  </ul>
                  {lowStockCount > 5 && <p className="text-xs ml-4">• ... and {lowStockCount - 5} more</p>}
                </div>
              </div>
              <button
                onClick={() => setFilterStock("low")}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all flex-shrink-0"
              >
                View Items
              </button>
            </div>
          </div>
        )}

        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className={`w-1 h-6 ${isShopTwo ? "bg-yellow-500" : "bg-blue-700"} rounded`}></span>
              Add-Ons
            </h2>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-3 mb-4">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 inline-flex">
                <FiSearch size={18} />
              </span>
              <input
                type="text"
                placeholder="Search add-ons..."
                value={addonSearchQuery}
                onChange={(e) => setAddonSearchQuery(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 ${isShopTwo ? "focus:border-yellow-500 focus:ring-yellow-100" : "focus:border-blue-700 focus:ring-blue-100"} transition-all outline-none text-sm`}
              />
            </div>
          </div>

          {addOnLoading ? (
            <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
              <p className="text-slate-600 text-sm">Loading add-ons...</p>
            </div>
          ) : filteredAddOns.length === 0 ? (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center mb-4">
              <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-slate-400 text-2xl inline-flex">
                  <FiPackage />
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">No Add-Ons Yet</h3>
              <p className="text-slate-600 text-sm mb-6">
                {addonSearchQuery ? "Try adjusting your search" : "Create add-ons for cashier selections"}
              </p>
              <button
                onClick={openAddOnModal}
                className={`inline-flex items-center gap-2 ${isShopTwo ? "bg-yellow-500 hover:bg-yellow-600 text-slate-900" : "bg-blue-700 hover:bg-blue-800 text-white"} px-5 py-2.5 rounded-lg transition-all font-medium text-sm`}
              >
                <FiPlus size={16} />
                Add Add-On
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden mb-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">Add-On Name</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">Usage per Product</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">Total Stock</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">Unit</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">Price (₱)</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">Servings Left</th>
                      <th className="text-center px-4 py-3 text-xs font-bold text-slate-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAddOns.map((addon) => {
                      const quantity = Number(addon.quantity) || 0;
                      const quantityPerItem = Number(addon.quantity_per_item) || 1;
                      const price = Number(addon.price) || 0;
                      const servingsLeft = Math.floor(quantity / quantityPerItem);
                      const percentageLeft = quantityPerItem > 0 && servingsLeft > 0
                        ? Math.min(100, (quantity / (quantityPerItem * servingsLeft)) * 100)
                        : 0;

                      return (
                        <tr key={addon.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-slate-900">{addon.name}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className={`text-sm font-semibold ${isShopTwo ? "text-yellow-700" : "text-blue-700"}`}>{quantityPerItem.toFixed(2)} {addon.unit}</div>
                            <div className="text-xs text-slate-500">per serving</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-slate-900">{quantity.toFixed(2)}</div>
                            <div className="text-xs text-slate-500">{addon.unit}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-slate-600 font-medium">{addon.unit}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className={`text-sm font-medium ${isShopTwo ? "text-yellow-700" : "text-blue-700"}`}>₱{price.toFixed(1)}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <div className="text-sm font-bold text-slate-900">{servingsLeft}</div>
                                <div className="w-full bg-slate-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full transition-all ${isShopTwo ? "bg-yellow-500" : "bg-blue-600"}`}
                                    style={{ width: `${percentageLeft}%` }}
                                  ></div>
                                </div>
                                <div className="text-xs text-slate-500 mt-1">{Math.round(percentageLeft)}% left</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => openDeleteModal(addon.id, addon.name, true)}
                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition-all text-xs font-medium flex items-center gap-1"
                              >
                                <FiTrash2 size={14} />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {filteredIngredients.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
            <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-slate-400 text-2xl inline-flex">
                <FiPackage />
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">No Ingredients Found</h3>
            <p className="text-slate-600 text-sm mb-6">
              {searchQuery ? "Try adjusting your search" : "Start by adding your first ingredient"}
            </p>
            <button
              onClick={handleCreateClick}
              className={`inline-flex items-center gap-2 ${isShopTwo ? "bg-yellow-500 hover:bg-yellow-600 text-slate-900" : "bg-blue-700 hover:bg-blue-800 text-white"} px-5 py-2.5 rounded-lg transition-all font-medium text-sm`}
            >
              <FiPlus size={16} />
              Add Ingredient
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">Ingredient Name</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">Quantity</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">Unit</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">Cost per Unit (₱)</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">Total Value (₱)</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">Status</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-slate-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredIngredients.map((item) => {
                    const threshold = getLowStockThreshold(item.unit);
                    const quantity = Number(item.quantity) || 0;
                    const isLowStock = quantity < threshold;
                    const price = Number(item.unit_price) || 0;
                    const itemValue = quantity * price;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`${isShopTwo ? "bg-yellow-100" : "bg-blue-50"} p-2 rounded-lg`}>
                              <span className={isShopTwo ? "text-yellow-700" : "text-blue-700"} style={{ display: "inline-flex" }}>
                                <FiPackage size={16} />
                              </span>
                            </div>
                            <span className="font-semibold text-slate-900 text-sm">{item.ingredient_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-base font-bold ${isLowStock ? "text-red-600" : "text-green-600"}`}>
                            {quantity}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-700 font-medium text-sm">{item.unit}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">
                            <span className="text-slate-700 font-medium block">
                              {item.unit_price !== null ? `₱${item.unit_price}` : "-"}
                            </span>
                            <span className="text-slate-500 text-xs">per unit</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-700 font-bold text-sm">₱{itemValue}</span>
                        </td>
                        <td className="px-4 py-3">
                          {isLowStock ? (
                            <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 px-2.5 py-1 rounded-full text-xs font-semibold">
                              <FiAlertCircle size={12} />
                              LOW STOCK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-xs font-semibold">
                              <FiCheckCircle size={12} />
                              Normal
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => handleEditClick(item)}
                              className={`${isShopTwo ? "bg-yellow-500 hover:bg-yellow-600 text-slate-900" : "bg-blue-700 hover:bg-blue-800 text-white"} px-3 py-1.5 rounded-lg transition-all text-xs font-medium flex items-center gap-1`}
                            >
                              <FiEdit size={14} />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteClick(item)}
                              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition-all text-xs font-medium flex items-center gap-1"
                            >
                              <FiTrash2 size={14} />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <IngredientForm
          mode={formMode}
          shopId={shopId}
          ingredient={selectedIngredient}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      )}

      {deleteModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 transform transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-red-600" style={{ display: "inline-flex" }}>
                  <FiAlertCircle size={24} />
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-900">Confirm Delete</h3>
            </div>

            <p className="text-slate-600 mb-2">
              Are you sure you want to delete <span className="font-semibold text-slate-900">"{deleteModal.name}"</span>?
            </p>
            <p className="text-sm text-slate-500 mb-6">This action cannot be undone.</p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={closeDeleteModal}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddOnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 transform transition-all max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900">Add New Add-On</h3>
              <button
                onClick={closeAddOnModal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                disabled={submittingAddOn}
              >
                <FiX size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmitAddOn} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Add-On Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={addOnForm.name}
                  onChange={handleAddOnChange}
                  placeholder="e.g., Brown Sugar Syrup"
                  className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 ${isShopTwo ? "focus:border-yellow-500 focus:ring-yellow-100" : "focus:border-blue-700 focus:ring-blue-100"} transition-all outline-none text-sm`}
                  required
                  disabled={submittingAddOn}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    value={addOnForm.quantity}
                    onChange={handleAddOnChange}
                    placeholder="0"
                    step="0.01"
                    min="0"
                    className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 ${isShopTwo ? "focus:border-yellow-500 focus:ring-yellow-100" : "focus:border-blue-700 focus:ring-blue-100"} transition-all outline-none text-sm`}
                    required
                    disabled={submittingAddOn}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Unit <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="unit"
                    value={addOnForm.unit}
                    onChange={handleAddOnChange}
                    className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 ${isShopTwo ? "focus:border-yellow-500 focus:ring-yellow-100" : "focus:border-blue-700 focus:ring-blue-100"} transition-all outline-none text-sm cursor-pointer bg-white`}
                    required
                    disabled={submittingAddOn}
                  >
                    <option value="ml">ml</option>
                    <option value="L">L</option>
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="pcs">pcs</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Usage per Product <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    name="quantity_per_item"
                    value={addOnForm.quantity_per_item}
                    onChange={handleAddOnChange}
                    placeholder="1"
                    step="0.01"
                    min="0"
                    className={`flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 ${isShopTwo ? "focus:border-yellow-500 focus:ring-yellow-100" : "focus:border-blue-700 focus:ring-blue-100"} transition-all outline-none text-sm`}
                    required
                    disabled={submittingAddOn}
                  />
                  <div className="flex items-center justify-center px-3 bg-slate-100 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 min-w-fit">
                    {addOnForm.unit || "ml"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Cost per Unit (₱) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="unit_price"
                    value={addOnForm.unit_price}
                    onChange={handleAddOnChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 ${isShopTwo ? "focus:border-yellow-500 focus:ring-yellow-100" : "focus:border-blue-700 focus:ring-blue-100"} transition-all outline-none text-sm`}
                    required
                    disabled={submittingAddOn}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Selling Price (₱) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="price"
                    value={addOnForm.price}
                    onChange={handleAddOnChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 ${isShopTwo ? "focus:border-yellow-500 focus:ring-yellow-100" : "focus:border-blue-700 focus:ring-blue-100"} transition-all outline-none text-sm`}
                    required
                    disabled={submittingAddOn}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeAddOnModal}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                  disabled={submittingAddOn}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex-1 px-4 py-2 ${isShopTwo ? "bg-yellow-500 hover:bg-yellow-600 text-slate-900" : "bg-blue-700 hover:bg-blue-800 text-white"} rounded-lg transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2`}
                  disabled={submittingAddOn}
                >
                  {submittingAddOn ? "Adding..." : <><FiPlus size={16} /> Add</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
