import { NextResponse, NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import bcrypt from "bcrypt";

const verifypassword = async(plainpassword: string, hashpassword: string) => {
    const match = await bcrypt.compare(plainpassword, hashpassword);
    return match;
}

export async function POST(req: NextRequest) {
    
    const { name, password, shopId } = await req.json();

    if (!name || !password || !shopId) return NextResponse.json({ success: false, message: "No Existing Field" }, { status: 404 });

    const { data, error } = await supabaseServer
    .from("tbl_users")
    .select("*")
    .eq("name", name)
    .limit(1);

    if (error) {
        console.log(error);
        return NextResponse.json({ success: false, message: "Supabase got an error" }, { status: 405 });
    }

    if (data && data.length <= 0) return NextResponse.json({ success: false, message: "User not exist" }, { status: 404 });

    const verify = verifypassword(password, data[0].password);

    if (!verify) return NextResponse.json({ success: false, message: "Wrong Password" }, { status: 403 });

    return NextResponse.json({ success: true, message: data }, { status: 200 });

}