import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const protectedRoutes = ["/dashboard", "/cashier", "/kitchen", "/order"];

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/barcelo" || request.nextUrl.pathname === "/goodcoffee") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const isProtectedRoute = protectedRoutes.some((route) =>
    request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(`${route}/`)
  );

  if (!isProtectedRoute) return NextResponse.next();

  const token = request.cookies.get("token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET || "");
    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.delete("token");
    return response;
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/cashier/:path*",
    "/kitchen/:path*",
    "/order/:path*",
    "/barcelo",
    "/goodcoffee",
  ],
};