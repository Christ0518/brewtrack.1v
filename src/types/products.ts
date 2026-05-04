export interface Ingredient {
  ingredient_id: string;
  amount: number;
}

export interface Variant {
  id?: string;
  name: string;
  price: number;
  quantity?: number;
  calculated_stock?: number;
  calculated_cost: number;
  ingredients: Ingredient[];
}

export interface Product {
  id?: string;
  category_id?: string;
  product_name: string;
  product_description: string;
  image?: File | string;
  variants: Variant[];
}
