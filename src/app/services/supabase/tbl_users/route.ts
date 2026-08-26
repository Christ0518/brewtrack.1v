import { NextResponse, NextRequest } from "next/server";
import bcrypt from "bcrypt";
import { supabaseServer } from "@/lib/supabase";

type LoginPayload = {
  name?: string;
  password?: string;
  shopId?: string | number;
};

const verifyPassword = async (plainPassword: string, hashedPassword: string) => {
  try {
    const match = await bcrypt.compare(plainPassword, hashedPassword);
    if (match) return true;
  } catch {
    // Fall back to plain text comparison for legacy rows.
  }

  return plainPassword === hashedPassword;
};

const normalizeUserRole = (user: Record<string, unknown>) => {
  const role = user.role ?? user.user_role ?? user.userRole;
  return {
    ...user,
    role: typeof role === "string" ? role : undefined,
  };
};

const normalizeShopId = (value: unknown): number | null => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return null;
  // Locked mapping: 1 = Barcelo, 2 = Good Coffee.
  if (parsed === 2) return 2;
  return 1;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as LoginPayload;
    const { name, password, shopId } = body;

    if (!name || !password) {
      return NextResponse.json({ success: false, message: "No Existing Field" }, { status: 400 });
    }

    let query = supabaseServer
      .from("tbl_users")
      .select("*")
      .eq("name", name);

    if (shopId !== undefined && shopId !== null) {
      const normalizedShopId = normalizeShopId(shopId);
      if (!normalizedShopId) {
        return NextResponse.json({ success: false, message: "Invalid shopId" }, { status: 400 });
      }
      query = query.eq("shop_id", normalizedShopId);
    }

    const { data, error } = await query.limit(20);

    if (error) {
      return NextResponse.json({ success: false, message: "Supabase got an error" }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ success: false, message: "User not exist" }, { status: 404 });
    }

    let authenticatedUser: (typeof data)[number] | undefined;
    for (const user of data) {
      if (await verifyPassword(password, String(user.password || ""))) {
        authenticatedUser = user;
        break;
      }
    }
    if (!authenticatedUser) {
      return NextResponse.json({ success: false, message: "Wrong Password" }, { status: 403 });
    }

    return NextResponse.json(
      {
        success: true,
        data: [normalizeUserRole(authenticatedUser as Record<string, unknown>)],
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
