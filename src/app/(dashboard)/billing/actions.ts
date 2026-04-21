"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAverageCost } from "@/lib/cost";

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

export async function getBills() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  try {
    const salesBills = await prisma.salesBill.findMany({
      where: { userId: user.id },
      include: {
        party: true,
        items: { include: { product: true } },
      },
      orderBy: { date: "desc" },
    });

    const purchaseBills = await prisma.purchaseBill.findMany({
      where: { userId: user.id },
      include: {
        party: true,
        items: { include: { product: true } },
      },
      orderBy: { date: "desc" },
    });

    return { success: true, salesBills, purchaseBills };
  } catch (error) {
    console.error("Failed to fetch bills:", error);
    return { success: false, error: "Failed to fetch bills" };
  }
}

export async function getBillingFormData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  try {
    const parties = await prisma.party.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" }
    });
    const products = await prisma.product.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" }
    });
    const priceLists = await prisma.priceList.findMany({
      where: { userId: user.id }
    });

    return { success: true, parties, products, priceLists };
  } catch (error) {
    console.error("Failed to fetch form data:", error);
    return { success: false, error: "Failed to fetch form data" };
  }
}

export async function createSalesBill(
  partyId: string,
  items: { productId: string; quantity: number; price: number }[],
  subtotal: number,
  discount: number,
  date?: Date
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  try {
    const total = subtotal - discount;
    const bill = await withRetry(async (tx) => {
      const itemsWithCost = await Promise.all(items.map(async (item) => {
        const costPrice = await getCurrentAverageCost(item.productId);
        return {
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          costPrice,
        };
      }));

      const bill = await tx.salesBill.create({
        data: {
          partyId,
          total,
          discount,
          date,
          userId: user.id,
          items: {
            create: itemsWithCost.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              costPrice: item.costPrice,
              userId: user.id,
            })),
          },
        },
        include: { party: true, items: { include: { product: true } } },
      });

      await tx.party.updateMany({
        where: { id: partyId, userId: user.id },
        data: { balance: { increment: total } },
      });

      for (const item of items) {
        await tx.product.updateMany({
          where: { id: item.productId, userId: user.id },
          data: { stock: { decrement: item.quantity } },
        });
      }

      await tx.transaction.create({
        data: {
          partyId,
          amount: total,
          type: "DEBIT",
          purpose: `Sales Bill #${bill.id.slice(-6).toUpperCase()}`,
          userId: user.id,
        },
      });

      return bill;
    }, { maxRetries: 3, timeout: 15000 });

    revalidatePath("/billing");
    revalidatePath("/parties");
    revalidatePath("/products");
    revalidatePath("/dashboard");
    return { success: true, bill };
  } catch (error) {
    console.error("Failed to create sales bill:", error);
    return { success: false, error: "Failed to create sales bill" };
  }
}

export async function updateSalesBill(
  oldBillId: string,
  partyId: string,
  items: { productId: string; quantity: number; price: number }[],
  subtotal: number,
  discount: number,
  date?: Date
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  try {
    const total = subtotal - discount;
    const result = await withRetry(async (tx) => {
      const oldBill = await tx.salesBill.findFirst({
        where: { id: oldBillId, userId: user.id },
        include: { items: true },
      });
      if (!oldBill) throw new Error("Original bill not found");

      await tx.party.updateMany({
        where: { id: oldBill.partyId, userId: user.id },
        data: { balance: { decrement: oldBill.total } },
      });
      for (const item of oldBill.items) {
        await tx.product.updateMany({
          where: { id: item.productId, userId: user.id },
          data: { stock: { increment: item.quantity } },
        });
      }
      await tx.transaction.create({
        data: {
          partyId: oldBill.partyId,
          amount: oldBill.total,
          type: "CREDIT",
          purpose: `Reversal of old Sales Bill #${oldBill.id.slice(-6).toUpperCase()}`,
          userId: user.id,
        },
      });
      await tx.salesItem.deleteMany({ where: { salesBillId: oldBillId, userId: user.id } });
      await tx.salesBill.deleteMany({ where: { id: oldBillId, userId: user.id } });

      const itemsWithCost = await Promise.all(items.map(async (item) => {
        const costPrice = await getCurrentAverageCost(item.productId);
        return {
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          costPrice,
        };
      }));

      const newBill = await tx.salesBill.create({
        data: {
          partyId,
          total,
          discount,
          date,
          userId: user.id,
          items: {
            create: itemsWithCost.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              costPrice: item.costPrice,
              userId: user.id,
            })),
          },
        },
        include: { party: true, items: { include: { product: true } } },
      });

      await tx.party.updateMany({
        where: { id: partyId, userId: user.id },
        data: { balance: { increment: total } },
      });
      for (const item of items) {
        await tx.product.updateMany({
          where: { id: item.productId, userId: user.id },
          data: { stock: { decrement: item.quantity } },
        });
      }
      await tx.transaction.create({
        data: {
          partyId,
          amount: total,
          type: "DEBIT",
          purpose: `Sales Bill #${newBill.id.slice(-6).toUpperCase()}`,
          userId: user.id,
        },
      });

      return newBill;
    }, { maxRetries: 3, timeout: 15000 });

    revalidatePath("/billing");
    revalidatePath("/parties");
    revalidatePath("/products");
    revalidatePath("/dashboard");
    return { success: true, bill: result };
  } catch (error) {
    console.error("Failed to update sales bill:", error);
    return { success: false, error: "Failed to update sales bill" };
  }
}

export async function createPurchaseBill(
  partyId: string,
  items: { productId: string; quantity: number; price: number }[],
  total: number,
  date?: Date
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  try {
    const bill = await withRetry(async (tx) => {
      const bill = await tx.purchaseBill.create({
        data: {
          partyId,
          total,
          date,
          userId: user.id,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              userId: user.id,
            })),
          },
        },
        include: { party: true, items: { include: { product: true } } },
      });

      await tx.party.updateMany({
        where: { id: partyId, userId: user.id },
        data: { balance: { decrement: total } },
      });

      for (const item of items) {
        await tx.product.updateMany({
          where: { id: item.productId, userId: user.id },
          data: { stock: { increment: item.quantity } },
        });
      }

      await tx.transaction.create({
        data: {
          partyId,
          amount: total,
          type: "CREDIT",
          purpose: `Purchase Bill #${bill.id.slice(-6).toUpperCase()}`,
          userId: user.id,
        },
      });

      return bill;
    }, { maxRetries: 3, timeout: 15000 });

    revalidatePath("/billing");
    revalidatePath("/parties");
    revalidatePath("/products");
    revalidatePath("/dashboard");
    return { success: true, bill };
  } catch (error) {
    console.error("Failed to create purchase bill:", error);
    return { success: false, error: "Failed to create purchase bill" };
  }
}

export async function updatePurchaseBill(
  oldBillId: string,
  partyId: string,
  items: { productId: string; quantity: number; price: number }[],
  total: number,
  date?: Date
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  try {
    const result = await withRetry(async (tx) => {
      const oldBill = await tx.purchaseBill.findFirst({
        where: { id: oldBillId, userId: user.id },
        include: { items: true },
      });
      if (!oldBill) throw new Error("Original bill not found");

      await tx.party.updateMany({
        where: { id: oldBill.partyId, userId: user.id },
        data: { balance: { increment: oldBill.total } },
      });
      for (const item of oldBill.items) {
        await tx.product.updateMany({
          where: { id: item.productId, userId: user.id },
          data: { stock: { decrement: item.quantity } },
        });
      }
      await tx.transaction.create({
        data: {
          partyId: oldBill.partyId,
          amount: oldBill.total,
          type: "DEBIT",
          purpose: `Reversal of old Purchase Bill #${oldBill.id.slice(-6).toUpperCase()}`,
          userId: user.id,
        },
      });
      await tx.purchaseItem.deleteMany({ where: { purchaseBillId: oldBillId, userId: user.id } });
      await tx.purchaseBill.deleteMany({ where: { id: oldBillId, userId: user.id } });

      const newBill = await tx.purchaseBill.create({
        data: {
          partyId,
          total,
          date,
          userId: user.id,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              userId: user.id,
            })),
          },
        },
        include: { party: true, items: { include: { product: true } } },
      });

      await tx.party.updateMany({
        where: { id: partyId, userId: user.id },
        data: { balance: { decrement: total } },
      });
      for (const item of items) {
        await tx.product.updateMany({
          where: { id: item.productId, userId: user.id },
          data: { stock: { increment: item.quantity } },
        });
      }
      await tx.transaction.create({
        data: {
          partyId,
          amount: total,
          type: "CREDIT",
          purpose: `Purchase Bill #${newBill.id.slice(-6).toUpperCase()}`,
          userId: user.id,
        },
      });

      return newBill;
    }, { maxRetries: 3, timeout: 15000 });

    revalidatePath("/billing");
    revalidatePath("/parties");
    revalidatePath("/products");
    revalidatePath("/dashboard");
    return { success: true, bill: result };
  } catch (error) {
    console.error("Failed to update purchase bill:", error);
    return { success: false, error: "Failed to update purchase bill" };
  }
}

export async function deleteSalesBill(billId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  try {
    await withRetry(async (tx) => {
      const bill = await tx.salesBill.findFirst({
        where: { id: billId, userId: user.id },
        include: { items: true },
      });
      if (!bill) throw new Error("Bill not found");

      await tx.party.updateMany({
        where: { id: bill.partyId, userId: user.id },
        data: { balance: { decrement: bill.total } },
      });
      for (const item of bill.items) {
        await tx.product.updateMany({
          where: { id: item.productId, userId: user.id },
          data: { stock: { increment: item.quantity } },
        });
      }
      await tx.transaction.create({
        data: {
          partyId: bill.partyId,
          amount: bill.total,
          type: "CREDIT",
          purpose: `Reversal of Sales Bill #${bill.id.slice(-6).toUpperCase()}`,
          userId: user.id,
        },
      });
      await tx.salesItem.deleteMany({ where: { salesBillId: billId, userId: user.id } });
      await tx.salesBill.deleteMany({ where: { id: billId, userId: user.id } });
    }, { maxRetries: 3, timeout: 15000 });

    revalidatePath("/billing");
    revalidatePath("/parties");
    revalidatePath("/products");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete sales bill:", error);
    return { success: false, error: "Failed to delete sales bill" };
  }
}

export async function deletePurchaseBill(billId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  try {
    await withRetry(async (tx) => {
      const bill = await tx.purchaseBill.findFirst({
        where: { id: billId, userId: user.id },
        include: { items: true },
      });
      if (!bill) throw new Error("Bill not found");

      await tx.party.updateMany({
        where: { id: bill.partyId, userId: user.id },
        data: { balance: { increment: bill.total } },
      });
      for (const item of bill.items) {
        await tx.product.updateMany({
          where: { id: item.productId, userId: user.id },
          data: { stock: { decrement: item.quantity } },
        });
      }
      await tx.transaction.create({
        data: {
          partyId: bill.partyId,
          amount: bill.total,
          type: "DEBIT",
          purpose: `Reversal of Purchase Bill #${bill.id.slice(-6).toUpperCase()}`,
          userId: user.id,
        },
      });
      await tx.purchaseItem.deleteMany({ where: { purchaseBillId: billId, userId: user.id } });
      await tx.purchaseBill.deleteMany({ where: { id: billId, userId: user.id } });
    }, { maxRetries: 3, timeout: 15000 });

    revalidatePath("/billing");
    revalidatePath("/parties");
    revalidatePath("/products");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete purchase bill:", error);
    return { success: false, error: "Failed to delete purchase bill" };
  }
}