"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function updatePriceList(partyId: string, productId: string, price: number) {
  try {
    await prisma.priceList.upsert({
      where: {
        partyId_productId: {
          partyId,
          productId,
        },
      },
      update: {
        price,
      },
      create: {
        partyId,
        productId,
        price,
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
  try {
    await prisma.priceList.delete({
      where: {
        partyId_productId: {
          partyId,
          productId,
        },
      },
    });

    revalidatePath(`/parties/${partyId}`);
    return { success: true };
  } catch (error) {
    // If it doesn't exist, that's fine
    if ((error as any).code === "P2025") {
      return { success: true };
    }
    console.error("Failed to reset price list:", error);
    return { success: false, error: "Failed to reset price list" };
  }
}
