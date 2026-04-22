"use client";

import { useMemo, useRef, useState } from "react";
import { Party, Product } from "@prisma/client";
import { Trash2, CheckSquare } from "lucide-react";
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
import { BillPreview } from "@/components/bill-preview";
import { createPurchaseBill } from "../billing/actions";
import { recordSupplierPaymentSplit } from "../cashflow/actions";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface NextOrderListProps {
  initialItems: Product[];
  suppliers: Party[];
  allProducts: Product[];
}

export function NextOrderList({
  initialItems,
  suppliers,
  allProducts,
}: NextOrderListProps) {
  const [items, setItems] = useState(() =>
    initialItems.map((item) => ({
      ...item,
      orderQty: Math.max(0, 50 - item.stock), 
      orderPrice: item.basePrice ?? 0,
    }))
  );

  function handleUpdateQty(id: string, qty: number) {
    setItems(items.map(item => 
      item.id === id ? { ...item, orderQty: qty } : item
    ));
  }

  function handleRemoveItem(id: string) {
    setItems(items.filter(item => item.id !== id));
  }

  const billRef = useRef<HTMLDivElement | null>(null);

  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [orderDate, setOrderDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [previewBill, setPreviewBill] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const supplier = suppliers.find((s) => s.id === supplierId) || null;

  const displayItems = useMemo(
    () =>
      supplier
        ? items.filter((i: any) => i.supplierId === supplier.id)
        : items,
    [items, supplier]
  );

  const totalItems = useMemo(
    () => displayItems.reduce((sum, i) => sum + (i.orderQty || 0), 0),
    [displayItems]
  );

  const billTotal = useMemo(
    () =>
      displayItems.reduce(
        (sum, i) =>
          sum +
          (i.orderQty || 0) * (i.orderPrice ?? i.basePrice ?? 0),
        0
      ),
    [displayItems]
  );

  const availableProductsToAdd = useMemo(
    () =>
      allProducts.filter(
        (p: any) =>
          (!supplier || p.supplierId === supplier.id) &&
          !displayItems.some((i) => i.id === p.id)
      ),
    [allProducts, displayItems, supplier]
  );

  const [newProductId, setNewProductId] = useState<string | null>(null);
  const [newQty, setNewQty] = useState<number>(1);
  const [newPrice, setNewPrice] = useState<string>("");

  function handleAddItem() {
    if (!newProductId) {
      alert("Please select a product to add");
      return;
    }
    const product = allProducts.find((p) => p.id === newProductId);
    if (!product) return;

    const qty = newQty > 0 ? newQty : 1;
    const price =
      newPrice.trim() !== ""
        ? parseFloat(newPrice)
        : product.basePrice ?? 0;

    setItems([
      ...items,
      {
        ...product,
        orderQty: qty,
        orderPrice: price,
      } as any,
    ]);
    setNewProductId("");
    setNewQty(1);
    setNewPrice("");
  }

  async function handlePreview() {
    if (!supplier) {
      alert("Please select a supplier");
      return;
    }
    if (!displayItems.some((i) => i.orderQty > 0)) {
      alert("Please set at least one order quantity > 0");
      return;
    }
    const date = orderDate ? new Date(orderDate) : new Date();
    setPreviewBill({
      id: "NEXT_ORDER_PREVIEW",
      date,
      total: billTotal,
      type: "PURCHASE" as const,
      party: {
        name: supplier.name,
        balance: supplier.balance,
      },
      items: displayItems
        .filter((i) => i.orderQty > 0)
        .map((i) => ({
          product: {
            name: i.name,
            variant: i.variant,
            company: i.company,
          },
          quantity: i.orderQty,
          price: i.basePrice ?? 0,
        })),
    });
  }

  async function handleDelivered() {
    if (!supplier) {
      alert("Please select a supplier");
      return;
    }
    const orderLines = displayItems.filter((i) => i.orderQty > 0);
    if (orderLines.length === 0) {
      alert("Please set at least one order quantity > 0");
      return;
    }

    const billItemsBase = orderLines.map((i) => ({
      productId: i.id,
      quantity: i.orderQty,
      price: i.basePrice ?? 0,
    }));

    const baseTotal = billItemsBase.reduce(
      (sum, i) => sum + i.quantity * i.price,
      0
    );

    const cashStr = window.prompt(
      "Enter cash amount (₹) for this supplier bill:",
      "0"
    );
    if (cashStr === null) return;
    const bankStr = window.prompt(
      "Enter bank amount (₹) for this supplier bill:",
      baseTotal > 0 ? String(baseTotal - (parseFloat(cashStr) || 0)) : "0"
    );
    if (bankStr === null) return;

    const cashAmount = parseFloat(cashStr) || 0;
    const bankAmount = parseFloat(bankStr) || 0;
    const total = cashAmount + bankAmount;

    if (total <= 0) {
      alert("Total amount must be greater than 0.");
      return;
    }

    let billItems = billItemsBase;
    if (baseTotal > 0 && total !== baseTotal) {
      const factor = total / baseTotal;
      billItems = billItemsBase.map((i) => ({
        ...i,
        price: i.price * factor,
      }));
    }

    setIsSubmitting(true);
    const date = orderDate ? new Date(orderDate) : new Date();
    const result = await createPurchaseBill(
      supplier.id,
      billItems,
      total,
      date
    );
    setIsSubmitting(false);

    if (!result.success) {
      alert(result.error || "Failed to create purchase bill");
      return;
    }

    await recordSupplierPaymentSplit(
      supplier.id,
      cashAmount,
      bankAmount,
      `Payment for Purchase Bill #${result.bill?.id.slice(-6).toUpperCase() || 'N/A'}`,
      date
    );

    setPreviewBill({ ...result.bill, type: "PURCHASE" });
    router.refresh();
  }

  if (initialItems.length === 0) {
    return (
      <div className="p-12 text-center text-gray-500">
        <CheckSquare className="w-12 h-12 text-green-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">Stock Levels Optimal</h3>
        <p>All products have sufficient stock. No orders needed at the moment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {previewBill && (
        <BillPreview bill={previewBill} onClose={() => setPreviewBill(null)} />
      )}
      <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="p-6 border-b border-border flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Next Order Bill</h3>
            <p className="text-sm text-muted-foreground">
              Prepare a supplier purchase order from low-stock items.
            </p>
          </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="space-y-1 flex-1">
              <label className="text-xs font-medium text-muted-foreground">
                Supplier
              </label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.length === 0 ? (
                    <div className="px-2 py-1 text-xs text-muted-foreground">
                      No suppliers found
                    </div>
                  ) : (
                    suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex-1">
              <label className="text-xs font-medium text-muted-foreground">
                Order Date
              </label>
              <Input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2 sm:self-end">
              <Button type="button" variant="outline" onClick={handlePreview}>
                Preview
              </Button>
              <Button
                type="button"
                onClick={handleDelivered}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating..." : "Mark Delivered"}
              </Button>
            </div>
          </div>
        </div>

        <div ref={billRef} className="p-6 space-y-6">
          <div className="flex justify-between items-start border-b pb-4 mb-4">
            <div>
              <p className="text-xs text-muted-foreground">Next Order Sheet</p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <div>Date: {new Date().toLocaleDateString()}</div>
            </div>
          </div>

          {/* Editable items table */}
          <div className="space-y-3">
            <div className="flex flex-col md:flex-row gap-3 md:items-end">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Add Product
                </label>
                <Select 
                  value={newProductId || ""} 
                  onValueChange={(value) => setNewProductId(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProductsToAdd.length === 0 ? (
                      <div className="px-2 py-1 text-xs text-muted-foreground">
                        All products already in list
                      </div>
                    ) : (
                      availableProductsToAdd.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.variant})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Qty
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={newQty}
                    onChange={(e) =>
                      setNewQty(parseInt(e.target.value) || 1)
                    }
                    className="w-20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Price (₹)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-24"
                  />
                </div>
                <div className="self-end pb-0.5">
                  <Button type="button" onClick={handleAddItem}>
                    Add Item
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead>Company</TableHead>
                <TableHead className="text-right">Current Stock</TableHead>
                <TableHead className="text-right w-[130px]">Order Qty</TableHead>
                <TableHead className="w-[100px] print:hidden"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.name}
                    <div className="text-xs text-muted-foreground font-normal">
                      {item.type}
                    </div>
                  </TableCell>
                  <TableCell>{item.variant}</TableCell>
                  <TableCell>{item.company}</TableCell>
                  <TableCell className="text-right">
                    <span className="text-red-500 font-medium">{item.stock}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min="0"
                      value={item.orderQty}
                      onChange={(e) =>
                        handleUpdateQty(item.id, parseInt(e.target.value) || 0)
                      }
                      className="w-24 ml-auto text-right h-8"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        item.orderPrice !== undefined
                          ? item.orderPrice
                          : item.basePrice ?? 0
                      }
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((p) =>
                            p.id === item.id
                              ? {
                                  ...p,
                                  orderPrice:
                                    parseFloat(e.target.value) || 0,
                                }
                              : p
                          )
                        )
                      }
                      className="w-24 ml-auto text-right h-8"
                    />
                  </TableCell>
                  <TableCell className="print:hidden">
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(item.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex justify-end border-t pt-4 mt-4 text-sm">
            <div className="space-y-1 text-right">
              <div className="text-muted-foreground">Total lines:</div>
              <div className="font-semibold">{items.length}</div>
              <div className="text-muted-foreground">Total order quantity:</div>
              <div className="font-semibold">{totalItems}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
