import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase";

export async function POST() {
    const token = (await cookies()).get("token")?.value;

    const apikey = process.env.API_KEY;

    if (!apikey) return NextResponse.json({ success: false, error: "API is not Valid" }, { status: 401 });

    if (!token) {
        return NextResponse.json({ success: false, error: "UnAuth" }, { status: 401 });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "");
        if (!decoded || typeof decoded === "string" || !decoded.email) {
            return NextResponse.json({ success: false, error: "Invalid session" }, { status: 401 });
        }

        const { data: user, error } = await supabaseServer
            .from("tbl_users")
            .select("role")
            .eq("name", decoded.email)
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error("Session role lookup failed:", error);
            return NextResponse.json({ success: false, error: "Session verification failed" }, { status: 503 });
        }

        if (!user) {
            return NextResponse.json({ success: false, error: "User not found" }, { status: 401 });
        }

        return NextResponse.json(
            { success: true, message: { ...decoded, role: user.role } },
            { status: 200 }
        );
    } catch {
        return NextResponse.json({ success: false, error: "UnAuth" }, { status: 401 });
    }
}