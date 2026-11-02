import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { supabaseServer } from "@/lib/supabase";

type UserRow = Record<string, unknown>;

type UserCreatePayload = {
  name?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  password?: string;
};

type UserUpdatePayload = {
  id?: number | string;
  name?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
};

type PasswordPayload = {
  id?: number | string;
  username?: string;
  current_password?: string;
  new_password?: string;
  mode?: "change" | "forgot";
};

const normalizeUser = (row: UserRow) => {
  const role = row.role ?? row.user_role ?? row.userRole;

  return {
    id: row.id,
    name: row.name,
    first_name: row.first_name,
    last_name: row.last_name,
    role: typeof role === "string" ? role : "cashier",
    shop_id: row.shop_id,
    created_at: row.created_at,
  };
};

const verifyPassword = async (plainPassword: string, hashedPassword: string) => {
  try {
    const match = await bcrypt.compare(plainPassword, hashedPassword);
    if (match) return true;
  } catch {
    // Support legacy plaintext rows.
  }

  return plainPassword === hashedPassword;
};

const parseShopId = (req: NextRequest): number | null => {
  const fromHeader = req.headers.get("x-shop-id");
  const fromQuery = new URL(req.url).searchParams.get("shop_id");
  const raw = fromHeader || fromQuery;

  if (!raw) return null;
  const value = Number(raw);
  if (Number.isNaN(value)) return null;
  if (value === 2) return 2;
  return 1;
};

const authorizeShopAdmin = async (req: NextRequest, shopId: number) => {
  const token = req.cookies.get("token")?.value;
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) {
    return { authorized: false, status: 401, message: "A valid signed-in session is required" };
  }

  let username: string;
  try {
    const decoded = jwt.verify(token, secret);
    if (typeof decoded === "string" || typeof decoded.email !== "string") {
      return { authorized: false, status: 401, message: "A valid signed-in session is required" };
    }
    username = decoded.email;
  } catch {
    return { authorized: false, status: 401, message: "A valid signed-in session is required" };
  }

  const { data, error } = await supabaseServer
    .from("tbl_users")
    .select("id")
    .eq("name", username)
    .eq("shop_id", shopId)
    .eq("role", "admin")
    .maybeSingle();

  if (error) {
    return { authorized: false, status: 500, message: "Failed to verify staff-management permissions" };
  }

  if (!data) {
    return { authorized: false, status: 403, message: "An admin account for this shop is required" };
  }

  return { authorized: true, status: 200, message: "" };
};

const buildRolePayload = (role: string) => ({
  role,
});

export async function GET(req: NextRequest) {
  try {
    const shopId = parseShopId(req);
    if (!shopId) {
      return NextResponse.json({ success: false, message: "shop_id is required" }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from("tbl_users")
      .select("*")
      .eq("shop_id", shopId)
      .order("id", { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: (data || []).map((row) => normalizeUser(row as UserRow)) }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch users";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as UserCreatePayload;
    const shopId = parseShopId(req);

    if (!shopId) {
      return NextResponse.json({ success: false, message: "shop_id is required" }, { status: 400 });
    }

    const authorization = await authorizeShopAdmin(req, shopId);
    if (!authorization.authorized) {
      return NextResponse.json(
        { success: false, message: authorization.message },
        { status: authorization.status }
      );
    }

    if (!body.name || !body.first_name || !body.last_name || !body.role || !body.password) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(body.password, 10);

    const insertPayload = {
      name: body.name,
      first_name: body.first_name,
      last_name: body.last_name,
      password: hashedPassword,
      shop_id: shopId,
      ...buildRolePayload(body.role),
    };

    const { data, error } = await supabaseServer
      .from("tbl_users")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: normalizeUser(data as UserRow) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create user";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as UserUpdatePayload;
    const shopId = parseShopId(req);

    if (!shopId) {
      return NextResponse.json({ success: false, message: "shop_id is required" }, { status: 400 });
    }

    const authorization = await authorizeShopAdmin(req, shopId);
    if (!authorization.authorized) {
      return NextResponse.json(
        { success: false, message: authorization.message },
        { status: authorization.status }
      );
    }

    const id = Number(body.id);
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ success: false, message: "id is required" }, { status: 400 });
    }

    if (!body.name || !body.first_name || !body.last_name || !body.role) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const updatePayload = {
      name: body.name,
      first_name: body.first_name,
      last_name: body.last_name,
      ...buildRolePayload(body.role),
    };

    const { data, error } = await supabaseServer
      .from("tbl_users")
      .update(updatePayload)
      .eq("id", id)
      .eq("shop_id", shopId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: normalizeUser(data as UserRow) }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update user";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const shopId = parseShopId(req);
    const id = Number(url.searchParams.get("id"));

    if (!shopId) {
      return NextResponse.json({ success: false, message: "shop_id is required" }, { status: 400 });
    }

    const authorization = await authorizeShopAdmin(req, shopId);
    if (!authorization.authorized) {
      return NextResponse.json(
        { success: false, message: authorization.message },
        { status: authorization.status }
      );
    }

    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ success: false, message: "id is required" }, { status: 400 });
    }

    const { error } = await supabaseServer
      .from("tbl_users")
      .delete()
      .eq("id", id)
      .eq("shop_id", shopId);

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "User deleted" }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete user";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as PasswordPayload;
    const shopId = parseShopId(req);

    if (!shopId) {
      return NextResponse.json({ success: false, message: "shop_id is required" }, { status: 400 });
    }

    const authorization = await authorizeShopAdmin(req, shopId);
    if (!authorization.authorized) {
      return NextResponse.json(
        { success: false, message: authorization.message },
        { status: authorization.status }
      );
    }

    const id = Number(body.id);
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ success: false, message: "id is required" }, { status: 400 });
    }

    if (!body.new_password || body.new_password.length < 8) {
      return NextResponse.json({ success: false, message: "New password must be at least 8 characters" }, { status: 400 });
    }

    const { data: userRow, error: userError } = await supabaseServer
      .from("tbl_users")
      .select("id, name, password, shop_id")
      .eq("id", id)
      .eq("shop_id", shopId)
      .single();

    if (userError || !userRow) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    const mode = body.mode || "change";

    if (mode === "change") {
      if (!body.current_password) {
        return NextResponse.json({ success: false, message: "Current password is required" }, { status: 400 });
      }

      const isValid = await verifyPassword(body.current_password, String(userRow.password || ""));
      if (!isValid) {
        return NextResponse.json({ success: false, message: "Current password is incorrect" }, { status: 403 });
      }
    } else if (mode === "forgot" && body.username !== userRow.name) {
      return NextResponse.json({ success: false, message: "Username does not match the selected user" }, { status: 403 });
    }

    const hashedPassword = await bcrypt.hash(body.new_password, 10);

    const { error: updateError } = await supabaseServer
      .from("tbl_users")
      .update({ password: hashedPassword })
      .eq("id", id)
      .eq("shop_id", shopId);

    if (updateError) {
      return NextResponse.json({ success: false, message: updateError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        message: mode === "forgot" ? "Password reset successfully" : "Password changed successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update password";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
