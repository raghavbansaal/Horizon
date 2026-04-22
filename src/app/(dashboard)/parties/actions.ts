"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function getParties() {
  const user = await getAuthenticatedUser();
  const parties = await prisma.party.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
  });
  return { success: true, data: parties };
}

export async function addParty(formData: FormData) {
  const user = await getAuthenticatedUser();

  const name = formData.get("name") as string;
  const type = formData.get("type") as string;
  const initialBalance = parseFloat(formData.get("balance") as string || "0");

  if (!name || !type) {
    return { success: false, error: "Name and type are required" };
  }

  await prisma.user.upsert({
    where: { id: user.id },
    update: { email: user.email },
    create: { id: user.id, email: user.email },
  });

  const party = await prisma.party.create({
    data: { name, type, balance: initialBalance, userId: user.id },
  });

  revalidatePath("/parties");
  revalidatePath("/products");
  revalidatePath("/billing");
  revalidatePath("/dashboard");
  revalidatePath("/");
  return { success: true, data: party };
}

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
  const updated = await prisma.party.findFirst({
    where: { id, userId: user.id },
  });

  revalidatePath("/parties");
  revalidatePath("/products");
  revalidatePath("/billing");
  revalidatePath("/dashboard");
  revalidatePath("/");
  return { success: true, data: updated };
}

export async function deleteParty(id: string) {
  const user = await getAuthenticatedUser();

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
}