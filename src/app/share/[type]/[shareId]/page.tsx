import { notFound } from "next/navigation";
import { BillPreview } from "@/components/bill-preview";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SharedBillPage({
  params,
}: {
  params: { type: string; shareId: string };
}) {
  const type = params.type?.toLowerCase();
  const billId = params.shareId;

  if (!billId || (type !== "sales" && type !== "purchase")) {
    notFound();
  }

  if (type === "sales") {
    const bill = await prisma.salesBill.findUnique({
      where: { id: billId },
      include: {
        party: true,
        items: { include: { product: true } },
      },
    });

    if (!bill) notFound();

    return <BillPreview bill={{ ...bill, type: "SALES" }} mode="page" />;
  }

  const bill = await prisma.purchaseBill.findUnique({
    where: { id: billId },
    include: {
      party: true,
      items: { include: { product: true } },
    },
  });

  if (!bill) notFound();

  return <BillPreview bill={{ ...bill, type: "PURCHASE" }} mode="page" />;
}

