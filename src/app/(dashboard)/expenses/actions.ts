"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth } from "date-fns";
import { getAuthenticatedUser } from "@/lib/auth";

const scopedCashFlowType = (type: "CASH" | "BANK", userId: string) => `${type}__${userId}`;

export async function getExpenses(year?: number, month?: number) {
  const user = await getAuthenticatedUser();

  try {
    let where: any = { userId: user.id };
    if (year && month) {
      const start = startOfMonth(new Date(year, month - 1));
      const end = endOfMonth(start);
      where.date = { gte: start, lte: end };
    }
    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: "desc" },
    });
    return { success: true, data: expenses };
  } catch (error) {
    console.error("Failed to fetch expenses:", error);
    return { success: false, error: "Failed to fetch expenses" };
  }
}

export async function addExpense(formData: FormData) {
  const user = await getAuthenticatedUser();

  try {
    const name = formData.get("name") as string;
    const amountStr = formData.get("amount") as string;
    const dateStr = formData.get("date") as string;
    const paymentSource = formData.get("paymentSource") as string;

    if (!name || !amountStr) {
      return { success: false, error: "Name and amount are required" };
    }

    const amount = parseFloat(amountStr);
    const date = dateStr ? new Date(dateStr) : new Date();

    await prisma.$transaction(async (tx) => {
      await tx.expense.create({
        data: {
          name,
          amount,
          date,
          source: paymentSource === "CASH" || paymentSource === "BANK" ? paymentSource : null,
          userId: user.id,
        },
      });

      if (paymentSource === "CASH" || paymentSource === "BANK") {
        let cf = await tx.cashFlow.findFirst({ where: { type: scopedCashFlowType(paymentSource, user.id) } });
        if (cf) {
          await tx.cashFlow.update({
            where: { id: cf.id },
            data: { balance: { decrement: amount } }
          });
        } else {
          await tx.cashFlow.create({
            data: { type: scopedCashFlowType(paymentSource, user.id), balance: -amount }
          });
        }
      }
    });

    revalidatePath("/expenses");
    revalidatePath("/cashflow");
    revalidatePath("/stats");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Failed to add expense:", error);
    return { success: false, error: "Failed to add expense" };
  }
}

export async function deleteExpense(id: string) {
  const user = await getAuthenticatedUser();

  try {
    await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.findFirst({ where: { id, userId: user.id } });
      if (!expense) return;

      if (expense.source === "CASH" || expense.source === "BANK") {
        const cf = await tx.cashFlow.findFirst({ where: { type: scopedCashFlowType(expense.source, user.id) } });
        if (cf) {
          await tx.cashFlow.update({
            where: { id: cf.id },
            data: { balance: { increment: expense.amount } },
          });
        }
      }

      await tx.expense.deleteMany({ where: { id, userId: user.id } });
    });

    revalidatePath("/expenses");
    revalidatePath("/cashflow");
    revalidatePath("/stats");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete expense:", error);
    return { success: false, error: "Failed to delete expense" };
  }
}