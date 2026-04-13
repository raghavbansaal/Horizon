"use server";

import { createClient } from "../../../lib/supabase/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function signupAction(prevState: any, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const companyName = formData.get("companyName") as string;

  if (!email || !password || !companyName) {
    return { error: "Email, password, and company name are required", success: false };
  }

  const supabase = await createClient();

  const { error, data } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return { error: error.message, success: false };
  }

  if (data.user) {
    await prisma.user.upsert({
      where: { email },
      update: { companyName },
      create: { id: data.user.id, email, companyName },
    });
  }

  return { error: null, success: true };
}