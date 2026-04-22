import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PriceListManager } from "./price-list-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PartyDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    const user = await getAuthenticatedUser();
    // Await params – required in Next.js 15
    const { id } = await params;

    const party = await prisma.party.findUnique({
      where: { id, userId: user.id },
    });

    if (!party) {
      notFound();
    }

    // Fetch all products
    const products = await prisma.product.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    });

    // Fetch custom price list for this party
    const priceLists = await prisma.priceList.findMany({
      where: { partyId: id, userId: user.id },
    });

    // Fetch bills and transactions
    const [salesBills, purchaseBills, transactions] = await Promise.all([
      prisma.salesBill.findMany({
        where: { partyId: id, userId: user.id },
        orderBy: { date: "desc" },
      }),
      prisma.purchaseBill.findMany({
        where: { partyId: id, userId: user.id },
        orderBy: { date: "desc" },
      }),
      prisma.transaction.findMany({
        where: { partyId: id, userId: user.id },
        orderBy: { date: "desc" },
      }),
    ]);

    // Map products with custom prices
    const productsWithPrices = products.map((product) => {
      const customPrice = priceLists.find((pl) => pl.productId === product.id);
      return {
        ...product,
        customPrice: customPrice ? customPrice.price : product.basePrice,
        hasCustomPrice: !!customPrice,
      };
    });

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/parties"
            className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-foreground">{party.name}</h2>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  party.type === "CUSTOMER"
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                    : "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
                }`}
              >
                {party.type}
              </span>
              <span>•</span>
              <span
                className={`font-medium ${
                  party.balance > 0
                    ? "text-green-600 dark:text-green-400"
                    : party.balance < 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-muted-foreground"
                }`}
              >
                Balance: {party.balance > 0 ? "+" : ""}
                {party.balance.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <Tabs defaultValue="pricelist" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="pricelist">Price List</TabsTrigger>
            <TabsTrigger value="activity">Bills & Transactions</TabsTrigger>
          </TabsList>

          <TabsContent value="pricelist" className="mt-6">
            <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border overflow-hidden">
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold">Customized Price List</h3>
                <p className="text-sm text-muted-foreground">
                  Set specific prices for this party. These prices will override
                  the base price when generating bills.
                </p>
              </div>
              <PriceListManager
                partyId={party.id}
                initialProducts={productsWithPrices}
              />
            </div>
          </TabsContent>

          <TabsContent value="activity" className="mt-6 space-y-6">
            <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border overflow-hidden">
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold">Bills for this party</h3>
                <p className="text-sm text-muted-foreground">
                  All sales and purchase bills linked to this party.
                </p>
              </div>
              <div className="p-4 sm:p-6 space-y-6">
                <div>
                  <h4 className="text-sm font-semibold mb-3 text-muted-foreground">
                    Sales Bills
                  </h4>
                  {salesBills.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No sales bills for this party yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-muted-foreground">
                            <th className="py-2 pr-4">Date</th>
                            <th className="py-2 pr-4 text-right">Total (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {salesBills.map((bill) => (
                            <tr
                              key={bill.id}
                              className="border-t border-border/70"
                            >
                              <td className="py-2 pr-4">
                                {bill.date.toISOString().split("T")[0]}
                              </td>
                              <td className="py-2 pr-4 text-right font-medium">
                                {bill.total.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-3 text-muted-foreground">
                    Purchase Bills
                  </h4>
                  {purchaseBills.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No purchase bills for this party yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-muted-foreground">
                            <th className="py-2 pr-4">Date</th>
                            <th className="py-2 pr-4 text-right">Total (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {purchaseBills.map((bill) => (
                            <tr
                              key={bill.id}
                              className="border-t border-border/70"
                            >
                              <td className="py-2 pr-4">
                                {bill.date.toISOString().split("T")[0]}
                              </td>
                              <td className="py-2 pr-4 text-right font-medium">
                                {bill.total.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border overflow-hidden">
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold">Transactions</h3>
                <p className="text-sm text-muted-foreground">
                  All payments and adjustments recorded for this party.
                </p>
              </div>
              <div className="p-4 sm:p-6">
                {transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No transactions recorded for this party yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground">
                          <th className="py-2 pr-4">Date</th>
                          <th className="py-2 pr-4">Type</th>
                          <th className="py-2 pr-4">Purpose</th>
                          <th className="py-2 pr-4 text-right">Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((tx) => (
                          <tr
                            key={tx.id}
                            className="border-t border-border/70"
                          >
                            <td className="py-2 pr-4">
                              {tx.date.toISOString().split("T")[0]}
                            </td>
                            <td className="py-2 pr-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  tx.type === "CREDIT"
                                    ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                                    : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                                }`}
                              >
                                {tx.type}
                              </span>
                            </td>
                            <td className="py-2 pr-4 text-muted-foreground">
                              {tx.purpose}
                            </td>
                            <td className="py-2 pr-4 text-right font-medium">
                              {tx.amount.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  } catch (error) {
    console.error("Error loading party details:", error);
    // You can return a fallback UI or rethrow to show an error page
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded-md">
        Failed to load party details. Please try again later.
      </div>
    );
  }
}