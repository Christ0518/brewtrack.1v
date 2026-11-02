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

      const sessionCheck = await Fetch_to(api_links.jwt.verify);
      if (!sessionCheck.success) {
        showAlert("Login succeeded, but the session cookie was not accepted. Please try again.", {
          variant: "error",
          title: "Session Error",
        });
        return;
      }

      const requestedPath = new URLSearchParams(window.location.search).get("next");
      const nextPath = requestedPath && requestedPath.startsWith("/order/") ? requestedPath : getPostLoginRoute(normalizedRole);
      window.location.replace(nextPath);
    } catch (error) {
      console.error("Login error:", error);
      showAlert("Unable to log in. Please try again.", { variant: "error", title: "Login Failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[#FAF6F4] px-4 py-8">
      <AlertModal />
      <section className="w-full max-w-md rounded-3xl border border-[#E9DEDA] bg-white p-6 shadow-[0_20px_60px_rgba(81,55,48,0.12)] sm:p-9">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ECE6E2] text-2xl font-black text-[#C98A84] shadow-sm">B</div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#A65F58]">BrewTrack</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-[#2D2626]">Welcome back</h1>
          <p className="mt-2 text-sm text-[#796E6B]">Sign in to continue to your workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-bold text-[#4D413E]">Username</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="username"
              placeholder="Enter your username"
              className="w-full rounded-xl border border-[#E9DEDA] bg-[#FAF6F4] px-4 py-3 text-[#2D2626] outline-none focus:border-[#C98A84] focus:bg-white focus:ring-2 focus:ring-[#C98A84]/20"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-bold text-[#4D413E]">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Enter your password"
              className="w-full rounded-xl border border-[#E9DEDA] bg-[#FAF6F4] px-4 py-3 text-[#2D2626] outline-none focus:border-[#C98A84] focus:bg-white focus:ring-2 focus:ring-[#C98A84]/20"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#C98A84] px-4 py-3 font-black text-white shadow-sm transition-colors hover:bg-[#B97872] disabled:cursor-not-allowed disabled:bg-[#D8CCC8]"
          >
            {loading ? "Signing in..." : "Log In"}
          </button>
        </form>
      </section>
    </main>
  );
}
