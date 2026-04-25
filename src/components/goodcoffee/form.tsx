import {Fetch_to} from "@/utilities"
import {useState} from "react";
import api_links from "@/config/fetch_links/api_links.json" 
import {useRouter} from "next/navigation"

export default function Form () {

    const router = useRouter();
    const [form, setForm] = useState({
        name: "", password: "", shopId:"2"
    });
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async(e: React.FormEvent) => { e.preventDefault();
        
        if (!form.name || !form.password) return alert("Field are required")

        const response = await  Fetch_to(api_links.auth_login, form)

        if (response.success) {
            // The API response is nested: response.data.data or response.data.message
            const apiData = response.data.data || response.data.message || response.data;
            
            if (!apiData || !Array.isArray(apiData) || apiData.length === 0) {
                return alert("Login failed - no user data returned");
            }
            
            const userData = apiData[0];
            const userShopId = userData?.shop_id || userData?.shopId;
            const userRole = userData?.role;
            
            // Save to localStorage
            localStorage.setItem("shopId", String(userShopId));
            localStorage.setItem("user", JSON.stringify(userData));

            await Fetch_to(api_links.jwt.auth, {email: form.name });
            
            if (userRole === "kitchen") {
                router.push("/kitchen");
            } else if (userRole === "cashier") {
                router.push("/cashier");
            } else {
                router.push("/dashboard");
            }
        } else {
            alert(response.message)
        }
    }

    return (
        <form onSubmit={handleSubmit}>
            <input 
            type="text" 
            name="name" 
            id="name"  
            value={form.name}
            onChange={handleChange}
            autoComplete="username"
            placeholder="Enter your username"
            required />

            <input 
            type="text" 
            name="password"
            id="password"  
            value={form.password}
            onChange={handleChange}
            autoComplete="password"
            placeholder="Enter your password"
            required />
        <button > Login</button>
        </form>
    )
}