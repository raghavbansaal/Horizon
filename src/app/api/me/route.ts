import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const metadataCompanyName =
      typeof user.user_metadata?.companyName === "string"
        ? user.user_metadata.companyName
        : typeof user.user_metadata?.company_name === "string"
        ? user.user_metadata.company_name
        : null;

    let dbUser: { email: string; companyName: string | null; createdAt: Date } | null = null;
    try {
      dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { email: true, companyName: true, createdAt: true },
      });
      if (!dbUser && user.email) {
        dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { email: true, companyName: true, createdAt: true },
        });
      }
    } catch (dbError) {
      // Graceful fallback: profile menu should still load from auth metadata.
      console.error("Profile DB lookup failed:", dbError);
    }

    return NextResponse.json({
      email: dbUser?.email || user.email || "N/A",
      companyName: dbUser?.companyName || metadataCompanyName || "Not set",
      createdAt: dbUser?.createdAt || null,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
