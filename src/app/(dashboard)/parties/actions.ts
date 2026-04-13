"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "../../../../lib/supabase/server";

export async function getParties(type?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  try {
    const where: any = { userId: user.id };
    if (type) where.type = type;
    const parties = await prisma.party.findMany({
      where,
      orderBy: { name: "asc" },
    });
    return { success: true, data: parties };
  } catch (error) {
    console.error("Failed to fetch parties:", error);
    return { success: false, error: "Failed to fetch parties" };
  }
}

export async function addParty(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  try {
    const name = formData.get("name") as string;
    const type = formData.get("type") as string;
    const initialBalanceStr = formData.get("balance") as string;
    const initialBalance = parseFloat(initialBalanceStr || "0");

    if (!name || !type) {
      return { success: false, error: "Name and type are required" };
    }

    await prisma.party.create({
      data: { name, type, balance: initialBalance, userId: user.id },
    });

    revalidatePath("/parties");
    revalidatePath("/products");
    revalidatePath("/billing");
    revalidatePath("/dashboard");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to add party:", error);
    return { success: false, error: "Failed to add party" };
  }
}

export async function editParty(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  try {
    const name = formData.get("name") as string;
    const type = formData.get("type") as string;
    const balanceStr = formData.get("balance") as string;
    
    const updateData: any = {};
    if (name) updateData.name = name;
    if (type) updateData.type = type;
    if (balanceStr) updateData.balance = parseFloat(balanceStr);

    await prisma.party.updateMany({
      where: { id, userId: user.id },
      data: updateData,
    });

    revalidatePath("/parties");
    revalidatePath("/products");
    revalidatePath("/billing");
    revalidatePath("/dashboard");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to update party:", error);
    return { success: false, error: "Failed to update party" };
  }
}

export async function deleteParty(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.updateMany({
        where: { supplierId: id, userId: user.id },
        data: { supplierId: null },
      });

      await tx.priceList.deleteMany({ where: { partyId: id, userId: user.id } });

      await tx.transaction.deleteMany({ where: { partyId: id, userId: user.id } });

      await tx.salesItem.deleteMany({ where: { salesBill: { partyId: id, userId: user.id } } });
      await tx.salesBill.deleteMany({ where: { partyId: id, userId: user.id } });

      await tx.purchaseItem.deleteMany({ where: { purchaseBill: { partyId: id, userId: user.id } } });
      await tx.purchaseBill.deleteMany({ where: { partyId: id, userId: user.id } });

      await tx.party.deleteMany({ where: { id, userId: user.id } });
    });

    revalidatePath("/parties");
    revalidatePath("/products");
    revalidatePath("/billing");
    revalidatePath("/dashboard");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete party:", error);
    return { success: false, error: "Failed to delete party." };
  }
}