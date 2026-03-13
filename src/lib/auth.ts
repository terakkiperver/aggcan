import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export const COOKIE_NAME = "toys-session";

const JWT_SECRET_VALUE = "toys-local-dev-secret-change-in-production";
const JWT_SECRET = new TextEncoder().encode(
  JWT_SECRET_VALUE
);

export interface SessionPayload extends JWTPayload {
  userId: string;
  tenantId: string;
  fullName: string;
  role: string;
}

export async function createSessionToken(
  payload: Omit<SessionPayload, "iat" | "exp">
) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(JWT_SECRET);
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(token: string) {
  const forceInsecureCookie = process.env.COOKIE_SECURE === "false";
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && !forceInsecureCookie,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 8,
  };
}
