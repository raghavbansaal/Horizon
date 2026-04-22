import { getBills, getBillingFormData } from "./actions";
import { BillingManager } from "./billing-manager";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const user = await getAuthenticatedUser();

  const userRecord = await prisma.user.findUnique({
    where: { id: user.id },
    select: { companyName: true },
  });
  const companyName = userRecord?.companyName || "Horizon";

  const [billsRes, formRes] = await Promise.all([
    getBills(),
    getBillingFormData()
  ]);

  if (!billsRes.success || !formRes.success) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-md">
        Failed to load billing data.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Billing</h2>
      </div>

      <BillingManager 
        salesBills={billsRes.salesBills || []}
        purchaseBills={billsRes.purchaseBills || []}
        parties={formRes.parties || []}
        products={formRes.products || []}
        priceLists={formRes.priceLists || []}
        companyName={companyName}
      />
    </div>
  );
}