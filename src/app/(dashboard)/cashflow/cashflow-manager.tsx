"use client";

import { useState } from "react";
import { CashFlow, Transaction, Party } from "@prisma/client";
import { format } from "date-fns";
import { Download, AlertTriangle, Plus, DollarSign, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { deleteCashflowTransaction, reconcileBalance, recordPayment } from "./actions";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

type TransactionWithParty = Transaction & { party: Party | null };

interface CashFlowManagerProps {
  cashFlows: CashFlow[];
  transactions: TransactionWithParty[];
  parties: Party[];
  pendingReceivables: number;
}

export function CashFlowManager({
  cashFlows,
  transactions,
  parties,
  pendingReceivables,
}: CashFlowManagerProps) {
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [verifyType, setVerifyType] = useState<"CASH" | "BANK">("CASH");
  const [actualBalance, setActualBalance] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statementType, setStatementType] = useState<"CASH" | "BANK">("CASH");
  const [period, setPeriod] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [dateStr, setDateStr] = useState(new Date().toISOString().split("T")[0]);
  const router = useRouter();

  const cashBalance = cashFlows.find((c) => c.type === "CASH")?.balance || 0;
  const bankBalance = cashFlows.find((c) => c.type === "BANK")?.balance || 0;

  const discrepancy = parseFloat(actualBalance || "0") - (verifyType === "CASH" ? cashBalance : bankBalance);

  const statementTransactions = (() => {
    const base = transactions.filter((t: any) => t.source === statementType);
    const date = new Date(dateStr);
    const start = new Date(date);
    const end = new Date(date);
    if (period === "monthly") {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    } else if (period === "quarterly") {
      const q = Math.floor(date.getMonth() / 3);
      start.setMonth(q * 3, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(q * 3 + 3, 0);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
    }
    return base.filter((t) => {
      const d = new Date(t.date);
      return d >= start && d <= end;
    });
  })();

  async function handleDeleteTransaction(id: string) {
    if (!confirm("Delete this transaction? Cash/Bank and party balances will be reversed.")) return;
    setIsLoading(true);
    const res = await deleteCashflowTransaction(id);
    if (!res.success) {
      alert(res.error || "Failed to delete transaction");
    } else {
      router.refresh();
    }
    setIsLoading(false);
  }

  async function handleRecordPayment(formData: FormData) {
    setIsLoading(true);
    const result = await recordPayment(formData);
    if (result.success) {
      setIsPaymentOpen(false);
      router.refresh();
    } else {
      alert(result.error);
    }
    setIsLoading(false);
  }

  async function handleReconcile() {
    setIsLoading(true);
    const result = await reconcileBalance(verifyType, parseFloat(actualBalance), discrepancy);
    if (result.success) {
      setIsVerifyOpen(false);
      setActualBalance("");
      router.refresh();
    } else {
      alert(result.error);
    }
    setIsLoading(false);
  }

  function handleDownloadReport() {
    const headers = ["Date", "Type", "Party", "Purpose", "Amount"];
    const rows = transactions.map(t => [
      format(new Date(t.date), "yyyy-MM-dd HH:mm"),
      t.type,
      t.party?.name || "N/A",
      t.purpose.replace(/,/g, " "), // sanitize commas
      t.amount.toString()
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `cash_flow_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      {/* Balances Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card text-card-foreground p-6 rounded-xl shadow-sm border border-border flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-yellow-500" />
              <h3 className="text-sm font-medium text-muted-foreground">Cash Balance</h3>
            </div>
            <p className="text-3xl font-bold text-foreground">₹{cashBalance.toFixed(2)}</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => {
              setVerifyType("CASH");
              setActualBalance(cashBalance.toString());
              setIsVerifyOpen(true);
            }}
          >
            Verify Actual
          </Button>
        </div>

        <div className="bg-card text-card-foreground p-6 rounded-xl shadow-sm border border-border flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-blue-500" />
              <h3 className="text-sm font-medium text-muted-foreground">Bank Balance</h3>
            </div>
            <p className="text-3xl font-bold text-foreground">₹{bankBalance.toFixed(2)}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setVerifyType("BANK");
              setActualBalance(bankBalance.toString());
              setIsVerifyOpen(true);
            }}
          >
            Verify Actual
          </Button>
        </div>

        <div className="bg-card text-card-foreground p-6 rounded-xl shadow-sm border border-border flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <h3 className="text-sm font-medium text-muted-foreground">Pending Receivables</h3>
            </div>
            <p className="text-3xl font-bold text-foreground">
              ₹{pendingReceivables.toFixed(2)}
            </p>
          </div>
          <div className="text-xs text-muted-foreground max-w-[140px] text-right">
            Total amount customers still have to pay.
          </div>
        </div>
      </div>

      {/* Actions & List */}
      <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="p-6 border-b border-border flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="space-y-1 w-full sm:w-auto">
            <h3 className="text-lg font-semibold">
              {statementType === "CASH" ? "Cash Statement" : "Bank Statement"}
            </h3>
            <p className="text-sm text-muted-foreground">
              Filter by period and delete incorrect entries.
            </p>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <Select value={statementType} onValueChange={(v: any) => setStatementType(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="BANK">Bank</SelectItem>
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-[160px]"
            />
            <Button variant="outline" onClick={handleDownloadReport} className="flex-1 sm:flex-none">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            
            <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
              <DialogTrigger render={<Button className="flex-1 sm:flex-none" />}>
                <Plus className="w-4 h-4 mr-2" />
                Record Payment
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record Payment / Receipt</DialogTitle>
                </DialogHeader>
                <form action={handleRecordPayment} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Payment Type</label>
                    <Select name="paymentType" required defaultValue="RECEIPT">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="RECEIPT">Money Received (In)</SelectItem>
                        <SelectItem value="PAYMENT">Money Paid (Out)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Party</label>
                    <Select name="partyId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select party" />
                      </SelectTrigger>
                      <SelectContent>
                        {parties.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.balance > 0 ? `Owes ₹${p.balance}` : `You owe ₹${Math.abs(p.balance)}`})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Amount (₹)</label>
                      <Input name="amount" type="number" step="0.01" min="0.01" required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Paid Via</label>
                      <Select name="source" required defaultValue="CASH">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CASH">Cash</SelectItem>
                          <SelectItem value="BANK">Bank</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Purpose (Optional)</label>
                    <Input name="purpose" placeholder="e.g. Cleared pending dues" />
                  </div>
                  <div className="pt-4 flex justify-end">
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? "Saving..." : "Record Transaction"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Purpose / Party</TableHead>
              <TableHead className="text-right">In (+)</TableHead>
              <TableHead className="text-right">Out (-)</TableHead>
              <TableHead className="text-right w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {statementTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                  No transactions found.
                </TableCell>
              </TableRow>
            ) : (
              statementTransactions.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="text-gray-500 text-sm">
                    {format(new Date(t.date), "dd MMM yyyy, HH:mm")}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{t.purpose}</div>
                    {t.party && (
                      <div className="text-xs text-gray-500">Party: {t.party.name}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium text-green-600">
                    {t.type === "CREDIT" ? `+₹${t.amount.toFixed(2)}` : "-"}
                  </TableCell>
                  <TableCell className="text-right font-medium text-red-600">
                    {t.type === "DEBIT" ? `-₹${t.amount.toFixed(2)}` : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteTransaction(t.id)}
                      disabled={isLoading}
                      title="Delete transaction"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Verify Discrepancy Dialog */}
      <Dialog open={isVerifyOpen} onOpenChange={setIsVerifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify {verifyType === "CASH" ? "Cash" : "Bank"} Balance</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
              <span className="text-gray-600">System Calculated:</span>
              <span className="font-bold text-xl">
                ₹{(verifyType === "CASH" ? cashBalance : bankBalance).toFixed(2)}
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Actual Physical/Bank Balance (₹)</label>
              <Input 
                type="number" 
                step="0.01" 
                value={actualBalance}
                onChange={(e) => setActualBalance(e.target.value)}
                className="text-lg py-6"
              />
            </div>

            {actualBalance !== "" && discrepancy !== 0 && (
              <div className={`p-4 rounded-lg flex items-start gap-3 ${discrepancy < 0 ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
                <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${discrepancy < 0 ? 'text-red-500' : 'text-green-500'}`} />
                <div>
                  <h4 className="font-semibold">Discrepancy Detected</h4>
                  <p className="text-sm mt-1">
                    Actual balance is {Math.abs(discrepancy).toFixed(2)} {discrepancy < 0 ? 'LESS' : 'MORE'} than the calculated system balance.
                  </p>
                </div>
              </div>
            )}

            {actualBalance !== "" && discrepancy === 0 && (
              <div className="p-4 bg-green-50 text-green-800 rounded-lg flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="font-medium">Balances match perfectly.</span>
              </div>
            )}

            <div className="pt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsVerifyOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleReconcile} 
                disabled={isLoading || actualBalance === ""}
                className={discrepancy !== 0 ? "bg-orange-600 hover:bg-orange-700 text-white" : ""}
              >
                {isLoading ? "Saving..." : (discrepancy !== 0 ? "Reconcile Balance" : "Confirm Match")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
