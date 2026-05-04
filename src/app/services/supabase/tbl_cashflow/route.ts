import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

type CashFlowPayload = {
  id?: number | string;
  type?: string;
  category?: string;
  description?: string;
  amount?: number | string;
  date?: string;
  reference?: string | null;
};

function parseNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function mapTransaction(row: any) {
  return {
    id: row.id,
    type: row.type,
    category: row.category,
    description: row.description,
    amount: Number(row.amount) || 0,
    date: row.date,
    reference: row.reference,
    created_at: row.created_at,
  };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const type = url.searchParams.get("type");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const summary = url.searchParams.get("summary");
    const day = url.searchParams.get("date");

    if (id) {
      if (isNaN(Number(id))) {
        return NextResponse.json({ message: "Invalid transaction ID" }, { status: 400 });
      }

      const { data, error } = await supabaseServer
        .from("tbl_cashflow")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        return NextResponse.json({ message: "Transaction not found" }, { status: 404 });
      }

      return NextResponse.json(mapTransaction(data), { status: 200 });
    }

    let query = supabaseServer
      .from("tbl_cashflow")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (type) {
      query = query.eq("type", type);
    }

    if (startDate) {
      query = query.gte("date", startDate);
    }

    if (endDate) {
      query = query.lte("date", endDate);
    }

    if (day) {
      query = query.eq("date", day);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching transactions:", error);
      return NextResponse.json(
        { message: "Error fetching transactions", error: error.message },
        { status: 500 }
      );
    }

    const transactions = (data || []).map(mapTransaction);

    if (summary === "1" || summary === "true") {
      const payIn = transactions.filter((row) => row.type === "payin").reduce((sum, row) => sum + Number(row.amount || 0), 0);
      const payOut = transactions.filter((row) => row.type === "payout").reduce((sum, row) => sum + Number(row.amount || 0), 0);

      return NextResponse.json(
        {
          payIn,
          payOut,
          balance: payIn - payOut,
          transactions,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(transactions, { status: 200 });
  } catch (error: any) {
    console.error("Error in GET handler:", error);
    return NextResponse.json(
      { message: "Error fetching transactions", error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CashFlowPayload;
    const amount = parseNumber(body.amount);

    if (!body.type || !body.category || !body.description || amount === null || !body.date) {
      return NextResponse.json(
        { message: "All required fields must be provided" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseServer
      .from("tbl_cashflow")
      .insert({
        type: body.type,
        category: body.category,
        description: body.description,
        amount,
        date: body.date,
        reference: body.reference || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating transaction:", error);
      return NextResponse.json(
        { message: "Error creating transaction", error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Transaction recorded successfully", id: data.id },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error in POST handler:", error);
    return NextResponse.json(
      { message: "Error creating transaction", error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as CashFlowPayload;
    const id = parseNumber(body.id);
    const amount = parseNumber(body.amount);

    if (!id) {
      return NextResponse.json({ message: "Transaction ID is required" }, { status: 400 });
    }

    if (!body.type || !body.category || !body.description || amount === null || !body.date) {
      return NextResponse.json(
        { message: "All required fields must be provided" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseServer
      .from("tbl_cashflow")
      .update({
        type: body.type,
        category: body.category,
        description: body.description,
        amount,
        date: body.date,
        reference: body.reference || null,
      })
      .eq("id", id)
      .select("id")
      .single();

    if (error) {
      console.error("Error updating transaction:", error);
      return NextResponse.json(
        { message: "Error updating transaction", error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ message: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Transaction updated successfully" }, { status: 200 });
  } catch (error: any) {
    console.error("Error in PUT handler:", error);
    return NextResponse.json(
      { message: "Error updating transaction", error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    let id = url.searchParams.get("id");

    if (!id) {
      try {
        const body = (await req.json()) as CashFlowPayload;
        id = body.id?.toString() || null;
      } catch {
        // ignore non-JSON bodies
      }
    }

    if (!id || isNaN(Number(id))) {
      return NextResponse.json({ message: "Transaction ID is required" }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from("tbl_cashflow")
      .delete()
      .eq("id", id)
      .select("id")
      .single();

    if (error) {
      console.error("Error deleting transaction:", error);
      return NextResponse.json(
        { message: "Error deleting transaction", error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ message: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Transaction deleted successfully" }, { status: 200 });
  } catch (error: any) {
    console.error("Error in DELETE handler:", error);
    return NextResponse.json(
      { message: "Error deleting transaction", error: error.message },
      { status: 500 }
    );
  }
}
