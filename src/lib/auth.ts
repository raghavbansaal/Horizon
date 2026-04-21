import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  let dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) {
    try {
      dbUser = await prisma.user.create({
        data: { id: user.id, email: user.email! },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        // User already exists (concurrent creation) – fetch it
        dbUser = await prisma.user.findUnique({ where: { id: user.id } }) ||
                 await prisma.user.findUnique({ where: { email: user.email! } });
        if (!dbUser) throw error;
      } else {
        throw error;
      }
    }
  }
  return user;
}