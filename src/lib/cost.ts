import { prisma } from "@/lib/prisma";

export async function getCurrentAverageCost(productId: string): Promise<number> {
  const purchases = await prisma.purchaseItem.findMany({
    where: { productId },
    include: { purchaseBill: true },
    orderBy: { purchaseBill: { date: "asc" } },
  });

  if (purchases.length === 0) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    return product?.basePrice ?? 0;
  }

  let totalQty = 0;
  let totalCost = 0;
  for (const p of purchases) {
    totalQty += p.quantity;
    totalCost += p.quantity * p.price;
  }
  return totalCost / totalQty;
}