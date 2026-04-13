"use client";

import { useState } from "react";
import { Expense } from "@prisma/client";
import { Plus, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addExpense, deleteExpense } from "./actions";

interface ExpenseListProps {
  initialExpenses: Expense[];
}

export function ExpenseList({ initialExpenses }: ExpenseListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Get month from URL or default to current month
  const urlYear = searchParams.get("year");
  const urlMonth = searchParams.get("month");
  const selectedMonth = urlYear && urlMonth 
    ? `${urlYear}-${urlMonth.padStart(2, "0")}` 
    : new Date().toISOString().slice(0, 7);

  const handleMonthChange = (value: string) => {
    const [year, month] = value.split("-");
    router.push(`/expenses?year=${year}&month=${month}`);
  };

  const filteredExpenses = initialExpenses.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleAdd(formData: FormData) {
    setIsLoading(true);
    const result = await addExpense(formData);
    if (result.success) {
      setIsAddOpen(false);
      router.refresh();
    } else {
      alert(result.error);
    }
    setIsLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    setIsLoading(true);
    const result = await deleteExpense(id);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error);
    }
    setIsLoading(false);
  }

  return (
    <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search expenses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="w-40"
            />
          </div>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={<Button className="w-full sm:w-auto" />}>
            <Plus className="w-4 h-4 mr-2" />
            Record Expense
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record New Expense</DialogTitle>
            </DialogHeader>
            <form action={handleAdd} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Expense Name/Purpose</label>
                <Input name="name" required placeholder="e.g. Electricity Bill, Transportation" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Amount (₹)</label>
                <Input name="amount" type="number" step="0.01" required placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Date</label>
                <Input
                  name="date"
                  type="date"
                  defaultValue={new Date().toISOString().split("T")[0]}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Deduct from Balance</label>
                <Select name="paymentSource" defaultValue="NONE">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Do not deduct automatically</SelectItem>
                    <SelectItem value="CASH">Cash Balance</SelectItem>
                    <SelectItem value="BANK">Bank Balance</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Selecting Cash or Bank will automatically decrease the respective balance.
                </p>
              </div>
              <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save Expense"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Purpose</TableHead>
            <TableHead className="text-right">Amount (₹)</TableHead>
            <TableHead className="w-[100px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredExpenses.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                No expenses recorded for this period.
              </TableCell>
            </TableRow>
          ) : (
            filteredExpenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell className="font-medium">
                  {format(new Date(expense.date), "dd MMM yyyy")}
                </TableCell>
                <TableCell>{expense.name}</TableCell>
                <TableCell className="text-right font-medium text-red-600">
                  -₹{expense.amount.toFixed(2)}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(expense.id)}
                    >
                      <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}