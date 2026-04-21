"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { Prisma } from "@prisma/client";

// ========== Helper: Retry transaction (handles P2028) ==========
async function withRetry<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { maxRetries?: number; timeout?: number }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const timeout = options?.timeout ?? 15000;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await prisma.$transaction(fn, { timeout });
    } catch (error: any) {
      lastError = error;
      if (error.code === 'P2028' && attempt < maxRetries) {
        console.log(`Transaction failed (attempt ${attempt}), retrying...`);
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

// ========== GET PARTIES ==========
export async function getParties() {
  const user = await getAuthenticatedUser();
  const parties = await prisma.party.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
  });
  return { success: true, data: parties };
}

// ========== ADD PARTY ==========
export async function addParty(formData: FormData) {
  const user = await getAuthenticatedUser();

  const name = formData.get("name") as string;
  const type = formData.get("type") as string;
  const initialBalance = parseFloat(formData.get("balance") as string || "0");

  if (!name || !type) {
    return { success: false, error: "Name and type are required" };
  }

  await prisma.party.create({
    data: { name, type, balance: initialBalance, userId: user.id },
  });

  revalidatePath("/parties");
  return { success: true };
}

// ========== EDIT PARTY ==========
export async function editParty(id: string, formData: FormData) {
  const user = await getAuthenticatedUser();

  const name = formData.get("name") as string;
  const type = formData.get("type") as string;
  const balanceStr = formData.get("balance") as string;
  const balance = balanceStr ? parseFloat(balanceStr) : undefined;

  const updateData: any = {};
  if (name) updateData.name = name;
  if (type) updateData.type = type;
  if (balance !== undefined) updateData.balance = balance;

  await prisma.party.updateMany({
    where: { id, userId: user.id },
    data: updateData,
  });

  revalidatePath("/parties");
  return { success: true };
}

// ========== DELETE PARTY (with retry) ==========
export async function deleteParty(id: string) {
  const user = await getAuthenticatedUser();

  await withRetry(async (tx) => {
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
  }, { maxRetries: 3, timeout: 15000 });

  revalidatePath("/parties");
  return { success: true };
}