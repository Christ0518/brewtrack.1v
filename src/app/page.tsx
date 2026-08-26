"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Fetch_to } from "@/utilities";
import api_links from "@/config/fetch_links/api_links.json";
import { useAlertModal } from "@/hooks/useAlertModal";

export default function Home() {
  const router = useRouter();
  const { showAlert, AlertModal } = useAlertModal();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const getPostLoginRoute = (role?: string) => {
    const normalizedRole = role?.trim().toLowerCase();
    if (normalizedRole === "cashier") return "/cashier";
    if (normalizedRole === "kitchen") return "/kitchen";
    return "/dashboard";
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !password) {
      showAlert("Username and password are required", { variant: "error", title: "Validation Error" });
      return;
    }

    try {
      setLoading(true);
      const response = await Fetch_to(api_links.auth_login, { name: name.trim(), password });
      if (!response.success) {
        showAlert(response.message || "Login failed", { variant: "error", title: "Login Failed" });
        return;
      }

      const loginPayload = response.data as { data?: unknown } | undefined;
      const user = (Array.isArray(loginPayload?.data) ? loginPayload.data[0] : loginPayload?.data) as
        | {
            name?: string;
            first_name?: string;
            last_name?: string;
            role?: string;
            user_role?: string;
            userRole?: string;
            shop_id?: string | number;
          }
        | undefined;
      const resolvedShopId = String(user?.shop_id || "");

      if (!user || !resolvedShopId) {
        showAlert("Your account is not assigned to a shop", { variant: "error", title: "Login Failed" });
        return;
      }

      const normalizedRole = String(user.role || user.user_role || user.userRole || "").trim().toLowerCase();
      localStorage.setItem("user", JSON.stringify({
        ...user,
        name: user.name || [user.first_name, user.last_name].filter(Boolean).join(" "),
        first_name: user.first_name || user.name || "",
        last_name: user.last_name || "",
        role: normalizedRole,
        shop_id: resolvedShopId,
      }));
      localStorage.setItem("shopId", resolvedShopId);

      const shopResponse = await Fetch_to(
        `${api_links.tbl_shops}?id=${resolvedShopId}`,
        {},
        {},
        2,
        500,
        "GET"
      );
      if (shopResponse.success && shopResponse.data) {
        const shop = shopResponse.data as { name?: string; logo_url?: string | null; brand_color?: string | null };
        if (shop.name) localStorage.setItem("shopName", shop.name);
        if (shop.logo_url) localStorage.setItem("shopLogo", shop.logo_url);
        if (shop.brand_color) localStorage.setItem("shopColor", shop.brand_color);
      }

      const sessionResponse = await Fetch_to(api_links.jwt.auth, { email: name.trim() });
      if (!sessionResponse.success) {
        showAlert(sessionResponse.message || "Unable to create login session", { variant: "error", title: "Login Failed" });
        return;
      }

      window.location.replace(getPostLoginRoute(normalizedRole));
    } catch (error) {
      console.error("Login error:", error);
      showAlert("Unable to log in. Please try again.", { variant: "error", title: "Login Failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[#f8f1e8] px-4">
      <AlertModal />
      <section className="w-full max-w-md rounded-lg border border-[#d6c3af] bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-[#6c3030]">BrewTrack Login</h1>
          <p className="mt-1 text-sm text-[#8a6245]">Sign in to continue to your workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-[#6e5338]">Username</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="username"
              placeholder="Enter your username"
              className="w-full rounded-lg border border-[#d6c3af] px-4 py-2.5 text-[#6c3030] outline-none focus:border-[#6c3030] focus:ring-2 focus:ring-[#ead8c5]"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-[#6e5338]">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Enter your password"
              className="w-full rounded-lg border border-[#d6c3af] px-4 py-2.5 text-[#6c3030] outline-none focus:border-[#6c3030] focus:ring-2 focus:ring-[#ead8c5]"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#6c3030] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-[#522424] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Log In"}
          </button>
        </form>
      </section>
    </main>
  );
}
