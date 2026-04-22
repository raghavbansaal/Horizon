"use server";

import { differenceInDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function getNotifications() {
  try {
    const user = await getAuthenticatedUser();
    const customers = await prisma.party.findMany({
      where: { userId: user.id, type: "CUSTOMER" },
      include: {
        salesBills: {
          where: { userId: user.id },
          orderBy: { date: "desc" },
          select: { date: true },
        },
      },
    });

    const notifications = [];
    const today = new Date();

    for (const customer of customers) {
      const bills = customer.salesBills;
      
      // If no orders at all, skip or handle differently (we'll just skip)
      if (bills.length === 0) continue;

      const lastOrderDate = bills[0].date;
      const daysSinceLastOrder = differenceInDays(today, lastOrderDate);

      // Need at least 2 orders to establish a pattern
      if (bills.length >= 2) {
        let totalDaysBetweenOrders = 0;
        let intervalsCount = bills.length - 1;
        
        // Calculate average days between orders
        for (let i = 0; i < intervalsCount; i++) {
          const newer = bills[i].date;
          const older = bills[i + 1].date;
          totalDaysBetweenOrders += differenceInDays(newer, older);
        }

        const avgDaysBetweenOrders = Math.max(1, Math.round(totalDaysBetweenOrders / intervalsCount));
        
        // If it's been 50% longer than usual, trigger a notification
        if (daysSinceLastOrder > avgDaysBetweenOrders * 1.5) {
          notifications.push({
            id: `notif-${customer.id}`,
            partyId: customer.id,
            partyName: customer.name,
            lastOrderDate,
            daysSinceLastOrder,
            avgDaysBetweenOrders,
            type: "DELAYED_ORDER"
          });
        }
      } else if (bills.length === 1) {
        // Fallback for single order customers: flag if > 30 days
        if (daysSinceLastOrder > 30) {
          notifications.push({
            id: `notif-${customer.id}`,
            partyId: customer.id,
            partyName: customer.name,
            lastOrderDate,
            daysSinceLastOrder,
            avgDaysBetweenOrders: null,
            type: "INACTIVE_NEW_CUSTOMER"
          });
        }
      }
    }

    // Sort by most urgent (highest days over average)
    notifications.sort((a, b) => b.daysSinceLastOrder - a.daysSinceLastOrder);

    return { success: true, data: notifications };
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return { success: false, error: "Failed to fetch notifications" };
  }
}
