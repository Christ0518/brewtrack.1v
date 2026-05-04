"use client";

import {Fetch_to} from "@/utilities";
import { useEffect } from "react";
import {useRouter} from "next/navigation";
import api_links from "@/config/fetch_links/api_links.json";
import Sidebar from "@/components/sidebar";


export default function Dashboard() {
    const router = useRouter();

    useEffect(() => {
        const Verify = async () => {
            const response = await Fetch_to(api_links.jwt.verify);
            if (!response.success) return router.push("/");
        }; 
        Verify();
    });

    return (
        <div className="flex h-screen bg-slate-50">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                <div className="p-6">
                    <h1 className="text-3xl font-bold text-slate-900 mb-6">Dashboard</h1>
                    <p className="text-slate-600">Welcome to your dashboard. Use the sidebar to navigate.</p>
                </div>
            </div>
        </div>
    );
}