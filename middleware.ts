import { NextRequest, NextResponse } from "next/server";

const protectedRoutes = ["/dashboard", "/cashier", "/kitchen", "/order"];

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/barcelo" || request.nextUrl.pathname === "/goodcoffee") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const isProtectedRoute = protectedRoutes.some((route) =>
    request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(`${route}/`)
  );

  if (!isProtectedRoute) return NextResponse.next();

  const token = request.cookies.get("token")?.value;
  if (!token) {
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set(
      "next",
      request.nextUrl.pathname === "/order" ? "/order" : `${request.nextUrl.pathname}${request.nextUrl.search}`
    );
    return NextResponse.redirect(loginUrl);
  }

  try {
    const verificationResponse = await fetch(new URL("/services/jwt/verify", request.url), {
      method: "POST",
      headers: {
        cookie: request.headers.get("cookie") || `token=${token}`,
      },
      cache: "no-store",
    });

    if (verificationResponse.ok) return NextResponse.next();

    if (verificationResponse.status === 401) {
      const response = NextResponse.redirect(new URL("/", request.url));
      response.cookies.delete("token");
      return response;
    }

    console.warn("Session verification was unavailable; preserving the existing session.");
    return NextResponse.next();
  } catch {
    console.warn("Session verification request failed; preserving the existing session.");
    return NextResponse.next();
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