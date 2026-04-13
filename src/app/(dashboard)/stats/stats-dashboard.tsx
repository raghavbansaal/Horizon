"use client";

import { useState } from "react";
import { getStats } from "./actions";
import { TrendingUp, TrendingDown, DollarSign, Download, Calendar, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface StatsData {
  period: string;
  totalSales: number;
  totalExpenses: number;
  totalProfit: number;   // backward compatible (now gross profit)
  salesCount: number;
  expensesCount: number;
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  netProfit: number;
  stockValue: number;
}

export function StatsDashboard({ initialData }: { initialData: StatsData | undefined }) {
  const [data, setData] = useState<StatsData | undefined>(initialData);
  const [period, setPeriod] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [dateStr, setDateStr] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);

  async function handleLoadStats() {
    setIsLoading(true);
    const date = new Date(dateStr);
    const result = await getStats(period, date);
    if (result.success) {
      setData(result.data);
    } else {
      alert(result.error);
    }
    setIsLoading(false);
  }

  function handleDownloadReport() {
    if (!data) return;

    const csvContent = [
      ["Report Period", data.period],
      ["Total Sales (Revenue)", data.totalRevenue],
      ["Cost of Goods Sold (COGS)", data.totalCOGS],
      ["Gross Profit", data.grossProfit],
      ["Total Expenses", data.totalExpenses],
      ["Net Profit", data.netProfit],
      ["Number of Sales", data.salesCount],
      ["Number of Expenses", data.expensesCount],
      ["Stock Value", data.stockValue],
    ].map(e => e.join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `business_stats_${data.period.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (!data) return <div>No data available</div>;

  return (
    <div className="space-y-6">
      <div className="bg-card text-card-foreground p-4 rounded-xl shadow-sm border border-border flex flex-wrap items-end gap-4">
        <div className="space-y-2 flex-1 min-w-[200px]">
          <label className="text-sm font-medium">Period Type</label>
          <Select 
            value={period} 
            onValueChange={(v: any) => setPeriod(v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 flex-1 min-w-[200px]">
          <label className="text-sm font-medium">Select Date in Target Period</label>
          <Input 
            type="date" 
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
          />
        </div>

        <Button onClick={handleLoadStats} disabled={isLoading} className="mb-0.5">
          {isLoading ? "Loading..." : "Update Report"}
        </Button>
        <Button onClick={handleDownloadReport} variant="outline" className="mb-0.5">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-card text-card-foreground p-6 rounded-xl shadow-sm border border-border relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <TrendingUp className="w-24 h-24 text-green-500" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-green-50 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">Total Sales (Revenue)</h3>
            </div>
            <p className="text-3xl font-bold">₹{data.totalRevenue.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground mt-2">from {data.salesCount} bills in {data.period}</p>
          </div>
        </div>

        <div className="bg-card text-card-foreground p-6 rounded-xl shadow-sm border border-border relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <TrendingDown className="w-24 h-24 text-red-500" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-red-50 rounded-lg">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">Total Expenses</h3>
            </div>
            <p className="text-3xl font-bold">₹{data.totalExpenses.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground mt-2">from {data.expensesCount} records in {data.period}</p>
          </div>
        </div>

        <div className="bg-card text-card-foreground p-6 rounded-xl shadow-sm border border-border relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <DollarSign className="w-24 h-24 text-indigo-500" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <DollarSign className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">Net Profit</h3>
            </div>
            <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
              {data.netProfit < 0 ? "-" : ""}₹{Math.abs(data.netProfit).toFixed(2)}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {data.period} • Revenue - COGS - Expenses
            </p>
          </div>
        </div>

        <div className="bg-card text-card-foreground p-6 rounded-xl shadow-sm border border-border relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Package className="w-24 h-24 text-blue-500" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">Stock Value</h3>
            </div>
            <p className="text-3xl font-bold">₹{data.stockValue.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground mt-2">Current inventory value</p>
          </div>
        </div>
      </div>
    </div>
  );
}