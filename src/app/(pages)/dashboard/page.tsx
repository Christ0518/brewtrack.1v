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

    const pages = [
        { name: "Cashier", path: "/cashier", icon: "💳", description: "Process orders and checkouts" },
        { name: "Kitchen", path: "/kitchen", icon: "👨‍🍳", description: "Kitchen display system" },
        { name: "Products", path: "/dashboard/products", icon: "📦", description: "Manage products and variants" },
        { name: "Ingredients", path: "/dashboard/ingredients", icon: "🧂", description: "Manage ingredients and stock" },
        { name: "Transactions", path: "/dashboard/transactions", icon: "📊", description: "View order history" },
        { name: "Reports", path: "/dashboard/reports", icon: "📈", description: "Sales and cashflow reports" },
        { name: "Settings", path: "/dashboard/settings", icon: "⚙️", description: "System settings" },
       
    ];

    return (
        <div className="flex h-screen bg-slate-50">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                <div className="p-6">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Dashboard</h1>
                    <p className="text-slate-600 mb-8">Welcome to BrewTrack. Access different sections below.</p>
                    
                    {/* Pages Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {pages.map((page) => (
                            <button
                                key={page.path}
                                onClick={() => router.push(page.path)}
                                className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-lg hover:border-blue-400 transition-all text-left"
                            >
                                <div className="text-3xl mb-2">{page.icon}</div>
                                <h3 className="text-lg font-semibold text-slate-900">{page.name}</h3>
                                <p className="text-sm text-slate-600">{page.description}</p>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}