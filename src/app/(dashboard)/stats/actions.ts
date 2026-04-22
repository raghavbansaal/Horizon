"use server";

import { startOfMonth, endOfMonth, startOfYear, endOfYear, startOfQuarter, endOfQuarter, format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function getStats(period: "monthly" | "quarterly" | "yearly", date: Date = new Date()) {
  const user = await getAuthenticatedUser();

  try {
    let startDate: Date, endDate: Date;

    if (period === "monthly") {
      startDate = startOfMonth(date);
      endDate = endOfMonth(date);
    } else if (period === "quarterly") {
      startDate = startOfQuarter(date);
      endDate = endOfQuarter(date);
    } else {
      startDate = startOfYear(date);
      endDate = endOfYear(date);
    }

    const [salesItems, expenses, products] = await Promise.all([
      prisma.salesItem.findMany({
        where: {
          userId: user.id,
          salesBill: {
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
        select: {
          salesBillId: true,
          quantity: true,
          price: true,
          costPrice: true,
        },
      }),
      prisma.expense.findMany({
        where: {
          userId: user.id,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: { amount: true },
      }),
      prisma.product.findMany({
        where: { userId: user.id },
        select: { stock: true, basePrice: true },
      }),
    ]);

    let totalRevenue = 0;
    let totalCOGS = 0;
    const billIds = new Set();

    for (const item of salesItems) {
      totalRevenue += item.price * item.quantity;
      totalCOGS += item.costPrice * item.quantity;
      billIds.add(item.salesBillId);
    }

    const grossProfit = totalRevenue - totalCOGS;
    const salesCount = billIds.size;

    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const netProfit = grossProfit - totalExpenses;
    const stockValue = products.reduce((sum, p) => sum + p.stock * p.basePrice, 0);

    return {
      success: true,
      data: {
        totalSales: totalRevenue,
        totalProfit: grossProfit,
        totalExpenses,
        salesCount,
        expensesCount: expenses.length,
        period: format(startDate, period === "yearly" ? "yyyy" : period === "monthly" ? "MMMM yyyy" : "'Q'Q yyyy"),
        totalRevenue,
        totalCOGS,
        grossProfit,
        netProfit,
        stockValue,
      },
    };
  } catch (error) {
    console.error("Failed to fetch stats:", error);
    return { success: false, error: "Failed to fetch stats" };
  }
}