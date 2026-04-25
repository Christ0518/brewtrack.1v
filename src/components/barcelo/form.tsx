"use client";
import { Fetch_to } from "@/utilities";
import { useState } from "react";
import api_links from "@/config/fetch_links/api_links.json";
import { useRouter } from "next/navigation";

export default function Form() {
    const router = useRouter();
    const [form, setForm] = useState({
        name: "", password: "", shopId: "1"
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

   const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name || !form.password) 
        return alert("Fields are required");

    const response = await Fetch_to(api_links.auth_login, form);

    if (response.success) {
            console.log("DEBUG - Full response:", response);
            
            // The API response is nested: response.data.data or response.data.message
            const apiData = response.data.data || response.data.message || response.data;
            console.log("DEBUG - apiData:", apiData);
            
            if (!apiData || !Array.isArray(apiData) || apiData.length === 0) {
                console.error("ERROR - No user data in response!");
                return alert("Login failed - no user data returned");
            }
            
            const userData = apiData[0];
            console.log("DEBUG - userData:", userData);
            console.log("DEBUG - userData:", userData);
            console.log("DEBUG - userData keys:", Object.keys(userData || {}));
            
            const userShopId = userData?.shop_id || userData?.shopId;
            const userRole = userData?.role;
            
            console.log("DEBUG - userShopId:", userShopId);
            console.log("DEBUG - userRole:", userRole);
            console.log("DEBUG - typeof userRole:", typeof userRole);
            
            // Save to localStorage
            localStorage.setItem("shopId", String(userShopId));
            localStorage.setItem("user", JSON.stringify(userData));

            await Fetch_to(api_links.jwt.auth, { email: form.name });

            if (userRole === "kitchen") {
                console.log("✓ Redirecting to kitchen");
                router.push("/kitchen");
            } else if (userRole === "cashier") {
                console.log("✓ Redirecting to cashier");
                router.push("/cashier");
            } else {
                console.log("✗ Redirecting to dashboard (role was:", userRole, ")");
                router.push("/dashboard");
            }

        } else {
            alert(response.message);
        }
};

    return(
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
            />

            <button>Log In</button>
        </form>
    );
}