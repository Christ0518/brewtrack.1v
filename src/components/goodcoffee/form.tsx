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
                ? loginPayload.data[0] as { name?: string; first_name?: string; last_name?: string; role?: string; user_role?: string; userRole?: string; shop_id?: string | number } | undefined
                : loginPayload?.data as { name?: string; first_name?: string; last_name?: string; role?: string; user_role?: string; userRole?: string; shop_id?: string | number } | undefined;

            if (user) {
                const normalizedUser = {
                    ...user,
                    name: user.name || [user.first_name, user.last_name].filter(Boolean).join(" "),
                    first_name: user.first_name || user.name || "",
                    last_name: user.last_name || "",
                    role: String(user.role || user.user_role || user.userRole || "").trim().toLowerCase(),
                    shop_id: user.shop_id ?? resolvedShopId,
                };
                localStorage.setItem("user", JSON.stringify(normalizedUser));
            }

            if (shopResponse.success && shopResponse.data) {
                const shopData = shopResponse.data as { name?: string; logo_url?: string | null; brand_color?: string | null };
                if (shopData.name) {
                    localStorage.setItem("shopName", String(shopData.name));
                }
                if (shopData.logo_url) {
                    localStorage.setItem("shopLogo", String(shopData.logo_url));
                } else {
                    localStorage.removeItem("shopLogo");
                }
                localStorage.setItem("shopColor", theme.accentColor);
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
            <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
                <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-lg p-6 sm:p-8">
                    <div className="mb-6 text-center">
                        <h1 className="text-2xl font-bold text-slate-900">Good Coffee Login</h1>
                        <p className="text-sm text-slate-600 mt-1">Sign in to continue to your dashboard</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                                Username
                            </label>
                            <input
                                type="text"
                                name="name"
                                id="name"
                                value={form.name}
                                onChange={handleChange}
                                autoComplete="username"
                                placeholder="Enter your username"
                                required
                                className={`w-full border ${theme.accentBorderClass} ${theme.accentRingClass} rounded-lg px-4 py-2.5 outline-none`}
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                                Password
                            </label>
                            <input
                                type="password"
                                name="password"
                                id="password"
                                value={form.password}
                                onChange={handleChange}
                                autoComplete="current-password"
                                placeholder="Enter your password"
                                required
                                className={`w-full border ${theme.accentBorderClass} ${theme.accentRingClass} rounded-lg px-4 py-2.5 outline-none`}
                            />
                        </div>

                        <button
                            type="submit"
                            className={`w-full ${theme.accentClass} ${theme.accentHoverClass} rounded-lg px-4 py-2.5 font-semibold transition-colors`}
                        >
                            Log In
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
}