import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export async function createSession(email: string, secure: boolean) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not configured");
  }

  const token = jwt.sign({ email }, jwtSecret, { expiresIn: "120h" });

  (await cookies()).set({
    name: "token",
    value: token,
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 120 * 60 * 60,
  });
}