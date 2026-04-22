"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

const scopedCashFlowType = (type: "CASH" | "BANK", userId: string) => `${type}__${userId}`;

export async function getCashFlowData() {
  const user = await getAuthenticatedUser();

  try {
    const cashType = scopedCashFlowType("CASH", user.id);
    const bankType = scopedCashFlowType("BANK", user.id);

    let cash = await prisma.cashFlow.findFirst({ where: { type: cashType } });
    if (!cash) cash = await prisma.cashFlow.create({ data: { type: cashType, balance: 0 } });

    let bank = await prisma.cashFlow.findFirst({ where: { type: bankType } });
    if (!bank) bank = await prisma.cashFlow.create({ data: { type: bankType, balance: 0 } });

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        NOT: {
          OR: [
            { purpose: { startsWith: "Sales Bill #" } },
            { purpose: { startsWith: "Purchase Bill #" } },
            { purpose: { startsWith: "Initial " } },
            { purpose: { startsWith: "Discrepancy Reconciliation" } },
          ],
        },
      },
      include: { party: true },
      orderBy: { date: "desc" },
    });

    const parties = await prisma.party.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    });

    const pendingReceivables = parties
      .filter((p) => p.type === "CUSTOMER" && p.balance > 0)
      .reduce((sum, p) => sum + p.balance, 0);

    return {
      success: true,
      cashFlows: [
        { ...cash, type: "CASH" },
        { ...bank, type: "BANK" },
      ],
      transactions,
      parties,
      pendingReceivables,
    };
  } catch (error) {
    console.error("Failed to fetch cash flow data:", error);
    return { success: false, error: "Failed to fetch cash flow data" };
  }
}

export async function setInitialBalance(type: "CASH" | "BANK", amount: number) {
  const user = await getAuthenticatedUser();

  try {
    const cf = await prisma.cashFlow.findFirst({ where: { type: scopedCashFlowType(type, user.id) } });
    if (cf) {
      await prisma.cashFlow.update({
        where: { id: cf.id },
        data: { balance: amount },
      });
    } else {
      await prisma.cashFlow.create({
        data: { type: scopedCashFlowType(type, user.id), balance: amount },
      });
    }

    await prisma.transaction.create({
      data: {
        amount,
        type: "CREDIT",
        source: type,
        purpose: `Initial ${type} Balance Setup`,
        userId: user.id,
      }
    });

    revalidatePath("/cashflow");
    return { success: true };
  } catch (error) {
    console.error("Failed to set balance:", error);
    return { success: false, error: "Failed to set balance" };
  }
}

export async function reconcileBalance(type: "CASH" | "BANK", actualAmount: number, discrepancyAmount: number) {
  const user = await getAuthenticatedUser();

  try {
    const cf = await prisma.cashFlow.findFirst({ where: { type: scopedCashFlowType(type, user.id) } });
    if (cf) {
      await prisma.cashFlow.update({
        where: { id: cf.id },
        data: { balance: actualAmount },
      });
    } else {
      await prisma.cashFlow.create({
        data: { type: scopedCashFlowType(type, user.id), balance: actualAmount },
      });
    }

    await prisma.transaction.create({
      data: {
        amount: Math.abs(discrepancyAmount),
        type: discrepancyAmount > 0 ? "CREDIT" : "DEBIT",
        source: type,
        purpose: `Discrepancy Reconciliation (${type})`,
        userId: user.id,
      }
    });

    revalidatePath("/cashflow");
    return { success: true };
  } catch (error) {
    console.error("Failed to reconcile balance:", error);
    return { success: false, error: "Failed to reconcile balance" };
  }
}

export async function recordPayment(formData: FormData) {
  const user = await getAuthenticatedUser();

  try {
    const partyId = formData.get("partyId") as string;
    const amountStr = formData.get("amount") as string;
    const paymentType = formData.get("paymentType") as string;
    const source = formData.get("source") as string;
    const purpose = formData.get("purpose") as string;

    if (!partyId || !amountStr || !paymentType || !source) {
      return { success: false, error: "Missing required fields" };
    }

    const amount = parseFloat(amountStr);

    await prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          partyId,
          amount,
          type: paymentType === "RECEIPT" ? "CREDIT" : "DEBIT",
          source,
          purpose: purpose || (paymentType === "RECEIPT" ? "Payment Received" : "Payment Made"),
          userId: user.id,
        }
      });

      await tx.party.updateMany({
        where: { id: partyId, userId: user.id },
        data: {
          balance: paymentType === "RECEIPT" ? { decrement: amount } : { increment: amount }
        }
      });

      const cf = await tx.cashFlow.findFirst({ where: { type: scopedCashFlowType(source as "CASH" | "BANK", user.id) } });
      if (cf) {
        await tx.cashFlow.update({
          where: { id: cf.id },
          data: {
            balance: paymentType === "RECEIPT" ? { increment: amount } : { decrement: amount }
          }
        });
      }
    });

    revalidatePath("/cashflow");
    revalidatePath("/parties");
    return { success: true };
  } catch (error) {
    console.error("Failed to record payment:", error);
    return { success: false, error: "Failed to record payment" };
  }
}

export async function recordSupplierPaymentSplit(
  partyId: string,
  cashAmount: number,
  bankAmount: number,
  purpose: string,
  date: Date
) {
  const user = await getAuthenticatedUser();

  try {
    await prisma.$transaction(async (tx) => {
      const total = cashAmount + bankAmount;
      if (total <= 0) return;

      const record = async (amount: number, source: "CASH" | "BANK") => {
        if (amount <= 0) return;

        await tx.transaction.create({
          data: {
            partyId,
            amount,
            type: "DEBIT",
            source,
            purpose,
            date,
            userId: user.id,
          },
        });

        await tx.party.updateMany({
          where: { id: partyId, userId: user.id },
          data: { balance: { increment: amount } },
        });

        const cf = await tx.cashFlow.findFirst({ where: { type: scopedCashFlowType(source, user.id) } });
        if (cf) {
          await tx.cashFlow.update({
            where: { id: cf.id },
            data: { balance: { decrement: amount } },
          });
        } else {
          await tx.cashFlow.create({
            data: { type: scopedCashFlowType(source, user.id), balance: -amount },
          });
        }
      };

      await record(cashAmount, "CASH");
      await record(bankAmount, "BANK");
    });

    revalidatePath("/cashflow");
    revalidatePath("/parties");
    return { success: true };
  } catch (error) {
    console.error("Failed to record supplier payment split:", error);
    return { success: false, error: "Failed to record supplier payment" };
  }
}

export async function deleteCashflowTransaction(transactionId: string) {
  const user = await getAuthenticatedUser();

  try {
    await prisma.$transaction(async (tx) => {
      const t = await tx.transaction.findFirst({
        where: { id: transactionId, userId: user.id },
      });

      if (!t) {
        throw new Error("Transaction not found");
      }

      if (!t.source || (t.source !== "CASH" && t.source !== "BANK")) {
        throw new Error("This transaction cannot be deleted.");
      }
      if (
        t.purpose.startsWith("Sales Bill #") ||
        t.purpose.startsWith("Purchase Bill #") ||
        t.purpose.startsWith("Initial ") ||
        t.purpose.startsWith("Discrepancy Reconciliation")
      ) {
        throw new Error("System transactions cannot be deleted.");
      }

      if (t.partyId) {
        await tx.party.updateMany({
          where: { id: t.partyId, userId: user.id },
          data: {
            balance: t.type === "CREDIT" ? { increment: t.amount } : { decrement: t.amount },
          },
        });
      }

      const cf = await tx.cashFlow.findFirst({ where: { type: scopedCashFlowType(t.source as "CASH" | "BANK", user.id) } });
      if (cf) {
        await tx.cashFlow.update({
          where: { id: cf.id },
          data: {
            balance: t.type === "CREDIT" ? { decrement: t.amount } : { increment: t.amount },
          },
        });
      }

      await tx.transaction.deleteMany({ where: { id: transactionId, userId: user.id } });
    });

    revalidatePath("/cashflow");
    revalidatePath("/parties");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete transaction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete transaction",
    };
  }
}