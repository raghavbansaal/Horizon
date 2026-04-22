"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getCurrentAverageCost } from "@/lib/cost";
import { getAuthenticatedUser } from "@/lib/auth";

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

function aggregateItemsByProduct(items: { productId: string; quantity: number }[]) {
  const byProduct = new Map<string, number>();
  for (const item of items) {
    byProduct.set(item.productId, (byProduct.get(item.productId) || 0) + item.quantity);
  }
  return [...byProduct.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

export async function getBills() {
  const user = await getAuthenticatedUser();

  try {
    const [salesBills, purchaseBills] = await Promise.all([
      prisma.salesBill.findMany({
        where: { userId: user.id },
        include: {
          party: {
            select: {
              id: true,
              userId: true,
              name: true,
              type: true,
              balance: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  variant: true,
                  company: true,
                  cartonSize: true,
                },
              },
            },
          },
        },
        orderBy: { date: "desc" },
      }),
      prisma.purchaseBill.findMany({
        where: { userId: user.id },
        include: {
          party: {
            select: {
              id: true,
              userId: true,
              name: true,
              type: true,
              balance: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  variant: true,
                  company: true,
                  cartonSize: true,
                },
              },
            },
          },
        },
        orderBy: { date: "desc" },
      }),
    ]);

    return { success: true, salesBills, purchaseBills };
  } catch (error) {
    console.error("Failed to fetch bills:", error);
    return { success: false, error: "Failed to fetch bills" };
  }
}

export async function getBillingFormData() {
  const user = await getAuthenticatedUser();

  try {
    const [parties, products, priceLists] = await Promise.all([
      prisma.party.findMany({
        where: { userId: user.id },
        orderBy: { name: "asc" },
      }),
      prisma.product.findMany({
        where: { userId: user.id },
        orderBy: { name: "asc" },
      }),
      prisma.priceList.findMany({
        where: { userId: user.id },
      }),
    ]);

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
  const user = await getAuthenticatedUser();

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

      const grouped = aggregateItemsByProduct(items);
      await Promise.all(
        grouped.map((item) =>
          tx.product.updateMany({
            where: { id: item.productId, userId: user.id },
            data: { stock: { decrement: item.quantity } },
          })
        )
      );

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
  const user = await getAuthenticatedUser();

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
      const groupedOld = aggregateItemsByProduct(oldBill.items);
      await Promise.all(
        groupedOld.map((item) =>
          tx.product.updateMany({
            where: { id: item.productId, userId: user.id },
            data: { stock: { increment: item.quantity } },
          })
        )
      );
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
      const groupedNew = aggregateItemsByProduct(items);
      await Promise.all(
        groupedNew.map((item) =>
          tx.product.updateMany({
            where: { id: item.productId, userId: user.id },
            data: { stock: { decrement: item.quantity } },
          })
        )
      );
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
  const user = await getAuthenticatedUser();

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

      const grouped = aggregateItemsByProduct(items);
      await Promise.all(
        grouped.map((item) =>
          tx.product.updateMany({
            where: { id: item.productId, userId: user.id },
            data: { stock: { increment: item.quantity } },
          })
        )
      );

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
  const user = await getAuthenticatedUser();

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
      const groupedOld = aggregateItemsByProduct(oldBill.items);
      await Promise.all(
        groupedOld.map((item) =>
          tx.product.updateMany({
            where: { id: item.productId, userId: user.id },
            data: { stock: { decrement: item.quantity } },
          })
        )
      );
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
      const groupedNew = aggregateItemsByProduct(items);
      await Promise.all(
        groupedNew.map((item) =>
          tx.product.updateMany({
            where: { id: item.productId, userId: user.id },
            data: { stock: { increment: item.quantity } },
          })
        )
      );
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
  const user = await getAuthenticatedUser();

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
      const grouped = aggregateItemsByProduct(bill.items);
      await Promise.all(
        grouped.map((item) =>
          tx.product.updateMany({
            where: { id: item.productId, userId: user.id },
            data: { stock: { increment: item.quantity } },
          })
        )
      );
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
  const user = await getAuthenticatedUser();

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
      const grouped = aggregateItemsByProduct(bill.items);
      await Promise.all(
        grouped.map((item) =>
          tx.product.updateMany({
            where: { id: item.productId, userId: user.id },
            data: { stock: { decrement: item.quantity } },
          })
        )
      );
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