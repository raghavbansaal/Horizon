"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { BillPreview } from "@/components/bill-preview";
import { 
  Party, 
  Product, 
  PriceList, 
  SalesBill, 
  PurchaseBill, 
  SalesItem, 
  PurchaseItem 
} from "@prisma/client";
import { NewBillForm } from "./new-bill-form";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteSalesBill, deletePurchaseBill } from "./actions";

type SalesBillWithDetails = SalesBill & {
  party: Party;
  items: (SalesItem & { product: Product })[];
};

type PurchaseBillWithDetails = PurchaseBill & {
  party: Party;
  items: (PurchaseItem & { product: Product })[];
};

interface BillingManagerProps {
  salesBills: SalesBillWithDetails[];
  purchaseBills: PurchaseBillWithDetails[];
  parties: Party[];
  products: Product[];
  priceLists: PriceList[];
  companyName: string;
}

export function BillingManager({
  salesBills,
  purchaseBills,
  parties,
  products,
  priceLists,
  companyName,
}: BillingManagerProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("new");
  const [previewBill, setPreviewBill] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [editing, setEditing] = useState<
    | null
    | {
        mode: "edit";
        type: "SALES" | "PURCHASE";
        bill: SalesBillWithDetails | PurchaseBillWithDetails;
      }
  >(null);

  async function handleDelete(id: string, type: "SALES" | "PURCHASE") {
    if (!confirm("Are you sure you want to delete this bill? This will adjust party balance and stock.")) {
      return;
    }
    setIsDeleting(id);
    try {
      const res =
        type === "SALES" ? await deleteSalesBill(id) : await deletePurchaseBill(id);
      if (!res.success) {
        alert(res.error || "Failed to delete bill");
      } else {
        router.refresh();
      }
    } finally {
      setIsDeleting(null);
    }
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      {previewBill && (
        <BillPreview bill={previewBill} onClose={() => setPreviewBill(null)} companyName={companyName} />
      )}
      <TabsList className="grid w-full max-w-md grid-cols-3">
        <TabsTrigger value="new">New Bill</TabsTrigger>
        <TabsTrigger value="sales">Sales History</TabsTrigger>
        <TabsTrigger value="purchases">Purchase History</TabsTrigger>
      </TabsList>
      
      <TabsContent value="new" className="mt-6">
        <NewBillForm 
          parties={parties} 
          products={products} 
          priceLists={priceLists}
          initialBill={
            editing
              ? {
                  mode: "edit",
                  type: editing.type,
                  oldBillId: editing.bill.id,
                  partyId: editing.bill.partyId,
                  date: new Date(editing.bill.date).toISOString().split("T")[0],
                  items: editing.bill.items.map((i: any) => ({
                    productId: i.productId,
                    quantity: i.quantity,
                    price: i.price,
                  })),
                }
              : { mode: "create", type: "SALES", partyId: "", date: new Date().toISOString().split("T")[0], items: [] }
          }
          onSaved={async (bill, mode) => {
            router.refresh();
            setPreviewBill(bill);
            setActiveTab(bill.type === "PURCHASE" ? "purchases" : "sales");
            if (mode === "edit") {
              setEditing(null);
            }
          }}
        />
      </TabsContent>

      <TabsContent value="sales" className="mt-6">
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total (₹)</TableHead>
                <TableHead className="w-[140px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesBills.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No sales bills found.
                  </TableCell>
                </TableRow>
              ) : (
                salesBills.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell>{format(new Date(bill.date), "dd MMM yyyy, HH:mm")}</TableCell>
                    <TableCell className="font-medium">{bill.party.name}</TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-500">
                        {bill.items.map(i => `${i.product.name} (x${i.quantity})`).join(", ")}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      ₹{bill.total.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right space-x-1 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPreviewBill({ ...bill, type: "SALES" })}
                      >
                        <Eye className="w-4 h-4 text-indigo-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing({ mode: "edit", type: "SALES", bill });
                          setActiveTab("new");
                        }}
                      >
                        <Pencil className="w-4 h-4 text-gray-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(bill.id, "SALES")}
                        disabled={isDeleting === bill.id}
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
      </TabsContent>

      <TabsContent value="purchases" className="mt-6">
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total (₹)</TableHead>
                <TableHead className="w-[140px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseBills.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No purchase bills found.
                  </TableCell>
                </TableRow>
              ) : (
                purchaseBills.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell>{format(new Date(bill.date), "dd MMM yyyy, HH:mm")}</TableCell>
                    <TableCell className="font-medium">{bill.party.name}</TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-500">
                        {bill.items.map(i => `${i.product.name} (x${i.quantity})`).join(", ")}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium text-red-600">
                      ₹{bill.total.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right space-x-1 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPreviewBill({ ...bill, type: "PURCHASE" })}
                      >
                        <Eye className="w-4 h-4 text-indigo-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing({ mode: "edit", type: "PURCHASE", bill });
                          setActiveTab("new");
                        }}
                      >
                        <Pencil className="w-4 h-4 text-gray-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(bill.id, "PURCHASE")}
                        disabled={isDeleting === bill.id}
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
      </TabsContent>
    </Tabs>
  );
}