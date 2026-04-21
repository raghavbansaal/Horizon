"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function updatePriceList(partyId: string, productId: string, price: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  try {
    await prisma.priceList.upsert({
      where: {
        partyId_productId: {
          partyId,
          productId,
        },
      },
      update: { price },
      create: {
        partyId,
        productId,
        price,
        userId: user.id,
      },
    });

    revalidatePath(`/parties/${partyId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to update price list:", error);
    return { success: false, error: "Failed to update price list" };
  }
}

export async function resetPriceList(partyId: string, productId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  try {
    await prisma.priceList.deleteMany({
      where: {
        partyId,
        productId,
        userId: user.id,
      },
    });

    revalidatePath(`/parties/${partyId}`);
    return { success: true };
  } catch (error) {
    if ((error as any).code === "P2025") {
      return { success: true };
    }
    console.error("Failed to reset price list:", error);
    return { success: false, error: "Failed to reset price list" };
  }
}