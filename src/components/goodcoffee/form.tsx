"use client";
import { Fetch_to } from "@/utilities";
import { useState } from "react";
import api_links from "@/config/fetch_links/api_links.json";
import { useRouter } from "next/navigation";
import { useAlertModal } from "@/hooks/useAlertModal";
import { getShopTheme } from "@/lib/theme";

export default function Form() {
    const router = useRouter();
    const { showAlert, AlertModal } = useAlertModal();
    const [form, setForm] = useState({
        name: "", password: "", shopId: "2"
    });
    const theme = getShopTheme(form.shopId);

    const getPostLoginRoute = (role?: string) => {
        const normalizedRole = role?.trim().toLowerCase();
        if (normalizedRole === "cashier") return "/cashier";
        if (normalizedRole === "kitchen") return "/kitchen";
        return "/dashboard";
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async(e: React.FormEvent) => {
        e.preventDefault();

        if (!form.name || !form.password) return showAlert("Field are required", { variant: "error", title: "Validation Error" });

        const response = await Fetch_to(api_links.auth_login, form);

        if(response.success) {
            const resolvedShopId = String(form.shopId);
            localStorage.setItem("shopId", resolvedShopId);

            const shopResponse = await Fetch_to(
                `${api_links.tbl_shops}?id=${resolvedShopId}`,
                {},
                {},
                2,
                500,
                "GET"
            );

            const loginPayload = response.data as { data?: unknown } | undefined;
            const user = Array.isArray(loginPayload?.data)
                ? loginPayload.data[0] as { role?: string; shop_id?: string | number } | undefined
                : loginPayload?.data as { role?: string; shop_id?: string | number } | undefined;

            if (user) {
                localStorage.setItem("user", JSON.stringify(user));
            }

            if (shopResponse.success && shopResponse.data) {
                const shopData = shopResponse.data as { name?: string; brand_color?: string | null };
                if (shopData.name) {
                    localStorage.setItem("shopName", String(shopData.name));
                }
                localStorage.setItem("shopColor", shopData.brand_color || theme.accentColor);
            } else {
                localStorage.setItem("shopColor", theme.accentColor);
            }

            await Fetch_to(api_links.jwt.auth, { email: form.name });
            router.push(getPostLoginRoute(user?.role));

        } else {
            
            showAlert(response.message || "Login failed", { variant: "error", title: "Login Failed" });

        }

    };

    return(
        <>
            <AlertModal />
            <form onSubmit={handleSubmit}>
            <input 
            type="text" 
            name="name" 
            id="name" 
            value={form.name}
            onChange={handleChange}
            autoComplete="username"
            placeholder="Enter Your Username"
            required
            className={`border ${theme.accentBorderClass} ${theme.accentRingClass} rounded-lg px-4 py-2 outline-none`}
            />

            <input 
            type="password" 
            name="password" 
            id="password" 
            value={form.password}
            onChange={handleChange}
            autoComplete="password"
            placeholder="Enter Your Password"
            required
            className={`border ${theme.accentBorderClass} ${theme.accentRingClass} rounded-lg px-4 py-2 outline-none`}
            />

            <button className={`${theme.accentClass} ${theme.accentHoverClass} rounded-lg px-4 py-2`}>Log In</button>
            </form>
        </>
    );
}