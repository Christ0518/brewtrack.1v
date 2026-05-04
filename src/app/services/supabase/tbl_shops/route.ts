import { NextResponse, NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import bcrypt from "bcrypt";

const verifypassword = async(plainpassword: string, hashpassword: string) => {
    const match = await bcrypt.compare(plainpassword, hashpassword);
    return match;
};

const normalizeUserRole = (user: Record<string, unknown>) => {
    const role = user.role ?? user.user_role ?? user.userRole;
    return {
        ...user,
        role: typeof role === "string" ? role : undefined,
    };
};

// POST - User authentication (existing)
export async function POST(req: NextRequest) {
    
    const { name, password, shopId } = await req.json();

    if (!name || !password || !shopId) return NextResponse.json({ success: false, message: "No Existing Field" }, { status: 404 });

    const shopIdNumber = Number(shopId);
    if (Number.isNaN(shopIdNumber)) {
        return NextResponse.json({ success: false, message: "Invalid shopId" }, { status: 400 });
    }

    const { data, error } = await supabaseServer
    .from("tbl_users")
    .select("*")
    .eq("name", name)
    .eq("shop_id", shopIdNumber)
    .limit(1);

    if (error) {
        console.log(error);
        return NextResponse.json({ success: false, message: "Supabase got an error" }, { status: 405 });
    }

    if (data && data.length === 0) return NextResponse.json({ success: false, message: "User not exist" }, { status: 404 });

    const verify = await verifypassword(password, data[0].password);

    if (!verify) return NextResponse.json({ success: false, message: "Wrong Password" }, { status: 403 });

    return NextResponse.json(
        {
            success: true,
            data: (data || []).map((user) => normalizeUserRole(user as Record<string, unknown>)),
        },
        { status: 200 }
    );

}

// GET - Get all shops
export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const id = url.searchParams.get("id");

        // If id is provided, get single shop
        if (id) {
            if (isNaN(Number(id))) {
                return NextResponse.json({ message: "Invalid shop ID" }, { status: 400 });
            }

            const { data: shops, error } = await supabaseServer
                .from("tbl_shops")
                .select("id, name, is_active, logo_url, receipt_header, receipt_footer, brand_color")
                .eq("id", id)
                .eq("is_active", true)
                .limit(1);

            if (error) {
                console.error("Error fetching shop:", error);
                return NextResponse.json({ message: "Cannot fetch shop", error: error.message }, { status: 500 });
            }

            if (!shops || shops.length === 0) {
                return NextResponse.json({ message: "Shop not found" }, { status: 404 });
            }

            return NextResponse.json(
                {
                    ...shops[0],
                    brand_color: shops[0].brand_color || "#073dbe",
                },
                { status: 200 }
            );
        }

        // Get all shops
        const { data: shops, error } = await supabaseServer
            .from("tbl_shops")
            .select("id, name,  is_active, logo_url, receipt_header, receipt_footer, brand_color")
            .eq("is_active", true);

        if (error) {
            console.error("Error fetching shops:", error);
            return NextResponse.json({ message: "Cannot fetch shops", error: error.message }, { status: 500 });
        }

        return NextResponse.json(
            (shops || []).map((shop) => ({
                ...shop,
                brand_color: shop.brand_color || "#073dbe",
            })),
            { status: 200 }
        );
    } catch (error) {
        console.error("Error in GET handler:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}

// PUT - Update shop branding
export async function PUT(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        const { brand_color } = await req.json();

        if (!id || isNaN(Number(id))) {
            return NextResponse.json({ message: "Invalid shop ID" }, { status: 400 });
        }

        if (!brand_color) {
            return NextResponse.json({ message: "Brand color is required" }, { status: 400 });
        }

        // Validate hex color format
        const hexColorRegex = /^#[0-9A-F]{6}$/i;
        if (!hexColorRegex.test(brand_color)) {
            return NextResponse.json({ message: "Invalid hex color format" }, { status: 400 });
        }

        const { data, error } = await supabaseServer
            .from("tbl_shops")
            .update({ brand_color })
            .eq("id", id)
            .select();

        if (error) {
            console.error("Error updating shop branding:", error);
            return NextResponse.json({ message: "Cannot update shop branding", error: error.message }, { status: 500 });
        }

        if (!data || data.length === 0) {
            return NextResponse.json({ message: "Shop not found" }, { status: 404 });
        }

        return NextResponse.json({ message: "Shop branding updated successfully", brand_color }, { status: 200 });
    } catch (error) {
        console.error("Error in PUT handler:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}