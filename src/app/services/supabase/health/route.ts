"use server";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function GET() {
    

    try {

        const { data, error } = await supabaseServer
        .from("tbl_users")     
        .select("*")
        .limit(1);

        if (error) throw error;

        return NextResponse.json(
        { status: "healthy", message: " ==> Supabase connection successful", data: data },
        { status: 200 }
        );
    } catch (err) {
        console.error(" ==> Supabase health check failed:", err);

        return NextResponse.json(
        {
            status: "unhealthy",
            message: "Supabase connection failed",
            error: err instanceof Error ? err.message : "Unknown error"
        },
        { status: 503 }
        );
    }
}