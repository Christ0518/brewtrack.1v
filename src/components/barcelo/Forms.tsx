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

    const handleSubmit = async(e: React.FormEvent) => {
        e.preventDefault();

        if (!form.name || !form.password) return alert("Field are required");

        const response = await Fetch_to(api_links.auth_login, form);

        if(response.success) {

            await Fetch_to(api_links.jwt.auth, { email: form.name });
            router.push("/dashboard");

        } else {
            
            alert(response.message);

        }

    }

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