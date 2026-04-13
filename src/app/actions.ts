"use server";

import { logout as logoutSession } from "@/lib/session";
import { redirect } from "next/navigation";

export async function logoutAction() {
  await logoutSession();
  redirect("/login");
}
