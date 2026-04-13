import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { adminConfig } from "./config";

const secretKey = process.env.JWT_SECRET || "super-secret-key-for-development";
const key = new TextEncoder().encode(secretKey);

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${adminConfig.cookieDuration}s`)
    .sign(key);
}

export async function decrypt(input: string): Promise<any> {
  const { payload } = await jwtVerify(input, key, {
    algorithms: ["HS256"],
  });
  return payload;
}

export async function login(password: string) {
  if (password !== adminConfig.password) {
    return { success: false, error: "Invalid password" };
  }

  const expires = new Date(Date.now() + adminConfig.cookieDuration * 1000);
  const session = await encrypt({ role: "admin", expires });

  const cookieStore = await cookies();
  cookieStore.set(adminConfig.cookieName, session, {
    expires,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return { success: true };
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.set(adminConfig.cookieName, "", {
    expires: new Date(0),
    path: "/",
  });
}

export async function getSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get(adminConfig.cookieName)?.value;

  if (!session) return null;

  try {
    const payload = await decrypt(session);
    return payload;
  } catch (error) {
    return null;
  }
}
