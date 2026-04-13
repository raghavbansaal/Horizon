import { 
  TrendingUp, 
  DollarSign, 
  PackageOpen,
  Users,
  Activity
} from "lucide-react";
import Link from "next/link";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { createClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

async function getDashboardData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  try {
    const now = new Date();
    const startMonth = startOfMonth(now);
    const endMonth = endOfMonth(now);

    const salesItems = await prisma.salesItem.findMany({
      where: {
        userId: user.id,
        salesBill: {
          date: { gte: startMonth, lte: endMonth }
        }
      },
    });

    let totalRevenue = 0;
    let totalCOGS = 0;
    for (const item of salesItems) {
      totalRevenue += item.price * item.quantity;
      totalCOGS += item.costPrice * item.quantity;
    }
    const grossProfit = totalRevenue - totalCOGS;

    const monthlyExpenses = await prisma.expense.aggregate({
      _sum: { amount: true },
      where: { 
        userId: user.id,
        date: { gte: startMonth, lte: endMonth } 
      },
    });
    const expSum = monthlyExpenses._sum.amount || 0;

    const cashFlows = await prisma.cashFlow.findMany();
    const cashBalance = cashFlows.find((c) => c.type === "CASH")?.balance || 0;
    const bankBalance = cashFlows.find((c) => c.type === "BANK")?.balance || 0;

    const lowStockProducts = await prisma.product.findMany({
      where: { 
        userId: user.id,
        stock: { lte: 10 } 
      },
      take: 5,
    });

    const recentTransactions = await prisma.transaction.findMany({
      where: { userId: user.id },
      include: { party: true },
      orderBy: { date: "desc" },
      take: 5,
    });

    const topParties = await prisma.party.findMany({
      where: { 
        userId: user.id,
        type: "CUSTOMER" 
      },
      include: {
        salesBills: {
          orderBy: { date: "desc" },
          take: 12,
          select: { total: true, date: true },
        },
        _count: { select: { salesBills: true } },
      },
      take: 3,
      orderBy: {
        salesBills: {
          _count: "desc",
        },
      },
    });

    return {
      salesSum: totalRevenue,
      profitSum: grossProfit,
      cashBalance,
      bankBalance,
      lowStockProducts,
      recentTransactions,
      topParties,
    };
  } catch (error) {
    console.error("Failed to load dashboard data", error);
    return {
      salesSum: 0,
      profitSum: 0,
      cashBalance: 0,
      bankBalance: 0,
      lowStockProducts: [],
      recentTransactions: [],
      topParties: [],
    };
  }
}

export default async function Dashboard() {
  const data = await getDashboardData();

  return (
    <>
      <header className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Dashboard Overview</h2>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 text-sm font-medium">Total Sales (Month)</h3>
            <div className="p-2 bg-green-50 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">₹{data.salesSum.toFixed(2)}</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 text-sm font-medium">Total Profit (Month)</h3>
            <div className={`p-2 rounded-lg ${data.profitSum >= 0 ? "bg-indigo-50" : "bg-red-50"}`}>
              <TrendingUp className={`w-5 h-5 ${data.profitSum >= 0 ? "text-indigo-500" : "text-red-500"}`} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            {data.profitSum < 0 ? "-" : ""}₹{Math.abs(data.profitSum).toFixed(2)}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 text-sm font-medium">Cash Balance</h3>
            <div className="p-2 bg-yellow-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-yellow-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">₹{data.cashBalance.toFixed(2)}</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 text-sm font-medium">Bank Balance</h3>
            <div className="p-2 bg-blue-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-blue-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">₹{data.bankBalance.toFixed(2)}</p>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Party Insights</h3>
          <Link href="/parties" className="text-sm text-indigo-600 dark:text-indigo-300 font-medium hover:text-indigo-800 dark:hover:text-indigo-200">
            View all parties
          </Link>
        </div>
        <div className="relative">
          <div className="flex gap-4 overflow-x-auto pb-2 pr-4 snap-x snap-mandatory">
            {data.topParties.length === 0 ? (
              <div className="min-w-full bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800 text-center text-gray-500 dark:text-zinc-400 py-12">
                No customer data available yet. Generate some sales bills!
              </div>
            ) : (
              data.topParties.map((party) => {
                const totalOrders = party._count.salesBills;
                const totalSpentRecent = party.salesBills.reduce((sum, bill) => sum + bill.total, 0);
                const lastOrder = party.salesBills[0] || null;

                const billsAsc = [...party.salesBills]
                  .map((b) => ({ ...b, date: new Date(b.date) }))
                  .sort((a, b) => a.date.getTime() - b.date.getTime());

                let nextExpected: Date | null = null;
                let avgGapDays: number | null = null;
                let avgValue: number | null = null;
                if (billsAsc.length >= 2) {
                  const gaps: number[] = [];
                  for (let i = 1; i < billsAsc.length; i++) {
                    const diffMs = billsAsc[i].date.getTime() - billsAsc[i - 1].date.getTime();
                    gaps.push(Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24))));
                  }
                  const sumGaps = gaps.reduce((s, g) => s + g, 0);
                  avgGapDays = Math.max(1, Math.round(sumGaps / gaps.length));

                  const last = billsAsc[billsAsc.length - 1].date;
                  nextExpected = new Date(last);
                  nextExpected.setDate(nextExpected.getDate() + avgGapDays);

                  avgValue = billsAsc.reduce((s, b) => s + b.total, 0) / billsAsc.length;
                }

                const isUpcoming =
                  !!nextExpected && (nextExpected.getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 7;

                return (
                  <Link
                    key={party.id}
                    href={`/parties/${party.id}`}
                    className="block min-w-[320px] snap-start"
                  >
                    <Card className="h-full hover:ring-2 hover:ring-indigo-500/30 transition">
                      <CardHeader className="border-b">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <CardTitle className="truncate">{party.name}</CardTitle>
                            <CardDescription>
                              {totalOrders} orders • balance ₹{(party.balance ?? 0).toFixed(0)}
                            </CardDescription>
                          </div>
                          <div className="shrink-0 rounded-lg bg-indigo-500/10 p-2 text-indigo-400">
                            <Users className="h-5 w-5" />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg bg-muted/40 p-3">
                            <div className="text-xs text-muted-foreground">Orders value (last 12)</div>
                            <div className="text-base font-semibold">₹{totalSpentRecent.toFixed(0)}</div>
                          </div>
                          <div className="rounded-lg bg-muted/40 p-3">
                            <div className="text-xs text-muted-foreground">Avg bill</div>
                            <div className="text-base font-semibold">
                              {avgValue ? `₹${avgValue.toFixed(0)}` : "—"}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border border-foreground/10 p-3">
                          <div className="flex items-center gap-2 text-sm">
                            <Activity className="h-4 w-4 text-indigo-400" />
                            <span className="text-muted-foreground">Last order</span>
                          </div>
                          <div className="text-sm font-medium">
                            {lastOrder
                              ? `${format(new Date(lastOrder.date), "dd MMM")} • ₹${lastOrder.total.toFixed(0)}`
                              : "—"}
                          </div>
                        </div>

                        <div
                          className={[
                            "flex items-center justify-between rounded-lg p-3",
                            isUpcoming ? "bg-emerald-500/10 ring-1 ring-emerald-500/20" : "bg-muted/30",
                          ].join(" ")}
                        >
                          <div className="text-sm">
                            <div className="text-xs text-muted-foreground">Next expected order</div>
                            <div className="font-medium">
                              {nextExpected ? format(nextExpected, "dd MMM") : "Not enough history"}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground text-right">
                            {avgGapDays ? `~every ${avgGapDays} days` : ""}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Low Stock Alerts</h3>
            <Link href="/products" className="text-sm text-indigo-600 dark:text-indigo-300 font-medium hover:text-indigo-800 dark:hover:text-indigo-200">
              View all
            </Link>
          </div>
          
          {data.lowStockProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <PackageOpen className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">All stock levels are optimal</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.lowStockProducts.map(product => (
                <div key={product.id} className="flex justify-between items-center p-3 bg-red-50/50 rounded-lg border border-red-100">
                  <div>
                    <p className="font-medium text-gray-900">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.variant} • {product.company}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-red-600 font-bold">{product.stock} left</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Recent Transactions</h3>
            <Link href="/cashflow" className="text-sm text-indigo-600 dark:text-indigo-300 font-medium hover:text-indigo-800 dark:hover:text-indigo-200">
              View all
            </Link>
          </div>
          
          {data.recentTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <DollarSign className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">No recent transactions</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.recentTransactions.map(tx => (
                <div key={tx.id} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg transition-colors border border-transparent">
                  <div>
                    <p className="font-medium text-gray-900">{tx.purpose}</p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(tx.date), "dd MMM, HH:mm")} {tx.party ? `• ${tx.party.name}` : ''}
                    </p>
                  </div>
                  <div className={`font-medium ${tx.type === "CREDIT" ? "text-green-600" : "text-red-600"}`}>
                    {tx.type === "CREDIT" ? "+" : "-"}₹{tx.amount.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}