"use client";
import { Fetch_to } from "@/utilities";
import { useEffect } from "react";
import api_links from "@/config/fetch_links/api_links.json";
import { useRouter } from "next/navigation";

export default function Dashboard() {
    const router = useRouter();

    useEffect(() => {
        const Verify = async() => {
            const response = await Fetch_to(api_links.jwt.verify);
            if (!response.success) return router.push("/");
        }
        Verify();
    }, [])

    return(
        <main>
            <h1>User Already Login</h1>
            <button onClick={async() => {await Fetch_to(api_links.jwt.deauth); router.push("/");}}>LogOut</button>
        </main>
    )

}