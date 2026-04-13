"use client";

import { useState, useEffect } from "react";
import { Party, Product, PriceList } from "@prisma/client";
import { Plus, Trash2, Save, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSalesBill, createPurchaseBill, updateSalesBill, updatePurchaseBill } from "./actions";

interface NewBillFormProps {
  parties: Party[];
  products: Product[];
  priceLists: PriceList[];
  onSaved: (bill: any, mode: "create" | "edit") => void | Promise<void>;
  initialBill?: {
    mode: "create" | "edit";
    type: "SALES" | "PURCHASE";
    oldBillId?: string;
    partyId: string;
    date: string;
    items: { productId: string; quantity: number; price: number }[];
  } | null;
}

interface BillItem {
  id: string;
  productId: string;
  quantity: number;
  qtyUnit?: "PCS" | "CTN" | "L";
  qtyDeclared?: number;
  price: number;
}

export function NewBillForm({
  parties,
  products,
  priceLists,
  onSaved,
  initialBill,
}: NewBillFormProps) {
  const [billType, setBillType] = useState<"SALES" | "PURCHASE">(
    initialBill?.type ?? "SALES"
  );
  const [partyId, setPartyId] = useState<string>(initialBill?.partyId ?? "");
  const [items, setItems] = useState<BillItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [billDate, setBillDate] = useState<string>(
    initialBill?.date ?? new Date().toISOString().split("T")[0]
  );
  const [discount, setDiscount] = useState(0);

  useEffect(() => {
    if (!initialBill) return;
    setBillType(initialBill.type);
    setPartyId(initialBill.partyId);
    setBillDate(initialBill.date);
    setItems(
      initialBill.items.map((item) => ({
        id: Math.random().toString(36).substring(7),
        productId: item.productId,
        quantity: item.quantity,
        qtyUnit: "PCS",
        qtyDeclared: item.quantity,
        price: item.price,
      }))
    );
    setDiscount(0);
  }, [initialBill?.mode, initialBill?.partyId, initialBill?.date, initialBill?.type]);

  const availableParties = parties.filter(
    (p) => p.type === (billType === "SALES" ? "CUSTOMER" : "SUPPLIER")
  );
  const selectedParty = parties.find((p) => p.id === partyId);

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const total = subtotal - discount;

  // ========== HELPER FUNCTIONS (unchanged) ==========
  function parseLitersPerUnit(variant: string): number | null {
    const v = (variant || "").toLowerCase().replace(/\s+/g, "");
    const ml = v.match(/(\d+(?:\.\d+)?)ml/);
    if (ml) return parseFloat(ml[1]) / 1000;
    const l = v.match(/(\d+(?:\.\d+)?)l/);
    if (l) return parseFloat(l[1]);
    return null;
  }

  function toPieces(productId: string, declared: number, unit: "PCS" | "CTN" | "L") {
    const product: any = products.find((p) => p.id === productId);
    const cartonSize = Math.max(1, product?.cartonSize || 1);
    if (unit === "PCS") return Math.max(0, Math.floor(declared));
    if (unit === "CTN") return Math.max(0, Math.floor(declared)) * cartonSize;
    const litersPerUnit = parseLitersPerUnit(product?.variant || "");
    if (!litersPerUnit || litersPerUnit <= 0) return Math.max(0, Math.floor(declared));
    return Math.max(0, Math.round(declared / litersPerUnit));
  }

  function getProductPrice(productId: string) {
    const product = products.find((p) => p.id === productId);
    if (!product) return 0;

    if (billType === "SALES" && partyId) {
      const customPrice = priceLists.find(
        (pl) => pl.partyId === partyId && pl.productId === productId
      );
      if (customPrice) return customPrice.price;
    }
    return product.basePrice;
  }

  // ========== ITEM HANDLERS ==========
  function handleAddItem() {
    if (products.length === 0) {
      alert("No products found. Please add products first.");
      return;
    }
    const firstProduct = products[0];
    const newId = Math.random().toString(36).substring(7);
    setItems((prev) => [
      ...prev,
      {
        id: newId,
        productId: firstProduct.id,
        quantity: 1,
        qtyUnit: "PCS",
        qtyDeclared: 1,
        price: getProductPrice(firstProduct.id),
      },
    ]);
  }

  function handleUpdateItem(id: string, field: keyof BillItem, value: any) {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id !== id) return item;
        const updatedItem = { ...item, [field]: value };
        if (field === "productId") {
          updatedItem.price = getProductPrice(value);
          const unit = updatedItem.qtyUnit || "PCS";
          const declared = updatedItem.qtyDeclared ?? updatedItem.quantity ?? 1;
          updatedItem.quantity = toPieces(value, declared, unit);
        }
        if (field === "qtyDeclared") {
          const unit = updatedItem.qtyUnit || "PCS";
          updatedItem.quantity = toPieces(updatedItem.productId, value, unit);
        }
        if (field === "qtyUnit") {
          const declared = updatedItem.qtyDeclared ?? updatedItem.quantity ?? 1;
          updatedItem.quantity = toPieces(updatedItem.productId, declared, value);
        }
        if (field === "quantity") {
          updatedItem.qtyDeclared = value;
          updatedItem.qtyUnit = updatedItem.qtyUnit || "PCS";
          updatedItem.quantity = toPieces(updatedItem.productId, value, updatedItem.qtyUnit);
        }
        return updatedItem;
      })
    );
  }

  function handleRemoveItem(id: string) {
    setItems(items.filter((item) => item.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!partyId) {
      alert("Please select a party");
      return;
    }
    if (items.length === 0) {
      alert("Please add at least one item to the bill");
      return;
    }
    if (items.some(i => i.quantity <= 0 || i.price < 0)) {
      alert("Quantity must be > 0 and price cannot be negative");
      return;
    }
    if (discount > subtotal) {
      alert("Discount cannot exceed subtotal");
      return;
    }

    setIsLoading(true);

    const billItems = items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      price: item.price,
    }));

    const date = billDate ? new Date(billDate) : new Date();

    let result;
    const mode: "create" | "edit" = initialBill?.mode === "edit" ? "edit" : "create";
    if (mode === "edit" && initialBill?.oldBillId) {
      if (billType === "SALES") {
        result = await updateSalesBill(initialBill.oldBillId, partyId, billItems, subtotal, discount, date);
      } else {
        result = await updatePurchaseBill(initialBill.oldBillId, partyId, billItems, total, date);
      }
    } else {
      if (billType === "SALES") {
        result = await createSalesBill(partyId, billItems, subtotal, discount, date);
      } else {
        result = await createPurchaseBill(partyId, billItems, total, date);
      }
    }

    if (result.success) {
      setPartyId("");
      setItems([]);
      setBillDate(new Date().toISOString().split("T")[0]);
      setDiscount(0);
      await onSaved({ ...result.bill, type: billType }, mode);
    } else {
      alert(result.error);
    }

    setIsLoading(false);
  }

  // ========== JSX ==========
  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800 p-6 space-y-8"
    >
      <div className="flex flex-col md:flex-row gap-6">
        <div className="space-y-2 flex-1">
          <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">Bill Type</label>
          <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg">
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                billType === "SALES"
                  ? "bg-white dark:bg-zinc-950 text-indigo-600 dark:text-indigo-300 shadow-sm"
                  : "text-gray-500 dark:text-zinc-300 hover:text-gray-700 dark:hover:text-zinc-100"
              }`}
              onClick={() => {
                setBillType("SALES");
                setPartyId("");
              }}
            >
              Sales Bill
            </button>
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                billType === "PURCHASE"
                  ? "bg-white dark:bg-zinc-950 text-indigo-600 dark:text-indigo-300 shadow-sm"
                  : "text-gray-500 dark:text-zinc-300 hover:text-gray-700 dark:hover:text-zinc-100"
              }`}
              onClick={() => {
                setBillType("PURCHASE");
                setPartyId("");
              }}
            >
              Purchase Bill
            </button>
          </div>
        </div>

        <div className="space-y-2 flex-1">
          <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">
            {billType === "SALES" ? "Customer" : "Supplier"}
          </label>
          <Select value={partyId} onValueChange={(val) => setPartyId(val || "")}>
            <SelectTrigger>
              <SelectValue placeholder={`Select a ${billType === "SALES" ? "customer" : "supplier"}`} />
            </SelectTrigger>
            <SelectContent>
              {availableParties.length === 0 ? (
                <div className="p-2 text-sm text-gray-500 text-center">
                  No parties found for this type.
                </div>
              ) : (
                availableParties.map((party) => (
                  <SelectItem key={party.id} value={party.id}>
                    {party.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {selectedParty && (
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
              Current Balance: {selectedParty.balance > 0 ? "+" : ""}
              {selectedParty.balance.toFixed(2)}
            </p>
          )}
        </div>

        <div className="space-y-2 flex-1">
          <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">
            Bill Date
          </label>
          <Input
            type="date"
            value={billDate}
            onChange={(e) => setBillDate(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-zinc-100">
            {initialBill?.mode === "edit" ? "Edit Bill" : "Bill Items"}
          </h3>
          <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 bg-gray-50 dark:bg-zinc-950 rounded-xl border border-dashed border-gray-200 dark:border-zinc-800">
            <ShoppingCart className="w-10 h-10 text-gray-300 dark:text-zinc-700 mb-3" />
            <p className="text-gray-500 dark:text-zinc-400">No items added to this bill yet.</p>
            <Button
              type="button"
              variant="link"
              onClick={handleAddItem}
              className="mt-2 text-indigo-600 dark:text-indigo-300"
            >
              Add your first item
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 dark:bg-zinc-950 rounded-lg text-sm font-medium text-gray-500 dark:text-zinc-400">
              <div className="col-span-5">Product</div>
              <div className="col-span-2">Quantity</div>
              <div className="col-span-2">Price (₹)</div>
              <div className="col-span-2 text-right">Total</div>
              <div className="col-span-1"></div>
            </div>

            {items.map((item) => {
              const product = products.find((p) => p.id === item.productId);
              const itemTotal = item.quantity * item.price;
              const currentStock = product?.stock || 0;
              return (
                <div
                  key={item.id}
                  className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-4 md:p-0 border border-gray-100 dark:border-zinc-800 md:border-none rounded-lg bg-white dark:bg-zinc-950 md:bg-transparent"
                >
                  <div className="col-span-1 md:col-span-5 space-y-1">
                    <label className="text-xs text-gray-500 dark:text-zinc-400 md:hidden">Product</label>
                    <Select
                      value={item.productId}
                      onValueChange={(val) => handleUpdateItem(item.id, "productId", val)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.variant})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {billType === "SALES" && product && (
                      <p
                        className={`text-xs ${
                          currentStock < item.quantity
                            ? "text-red-500 font-medium"
                            : "text-gray-500 dark:text-zinc-400"
                        }`}
                      >
                        {(() => {
                          const p: any = product;
                          const cartonSize = Math.max(1, p.cartonSize || 1);
                          const cartons = Math.floor(currentStock / cartonSize);
                          const pcs = currentStock % cartonSize;
                          const litersPerUnit = (() => {
                            const v = (p.variant || "").toLowerCase().replace(/\s+/g, "");
                            const ml = v.match(/(\d+(?:\.\d+)?)ml/);
                            if (ml) return parseFloat(ml[1]) / 1000;
                            const l = v.match(/(\d+(?:\.\d+)?)l/);
                            if (l) return parseFloat(l[1]);
                            return null;
                          })();
                          const liters = litersPerUnit && litersPerUnit > 0
                            ? (currentStock * litersPerUnit).toFixed(2)
                            : null;
                          return (
                            <>
                              In stock: {cartons} cn • {pcs} pcs
                              {liters ? ` • ${liters} L` : ""}
                            </>
                          );
                        })()}
                      </p>
                    )}
                  </div>

                  <div className="col-span-1 md:col-span-2 space-y-1">
                    <label className="text-xs text-gray-500 dark:text-zinc-400 md:hidden">Quantity</label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="0"
                        value={item.qtyDeclared ?? item.quantity ?? ""}
                        onChange={(e) =>
                          handleUpdateItem(
                            item.id,
                            "qtyDeclared",
                            parseFloat(e.target.value) || 0
                          )
                        }
                      />
                      <Select
                        value={item.qtyUnit || "PCS"}
                        onValueChange={(val: any) =>
                          handleUpdateItem(item.id, "qtyUnit", val)
                        }
                      >
                        <SelectTrigger className="w-[110px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PCS">pcs</SelectItem>
                          <SelectItem value="CTN">carton</SelectItem>
                          <SelectItem value="L">L</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-2 space-y-1">
                    <label className="text-xs text-gray-500 dark:text-zinc-400 md:hidden">Price (₹)</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.price === 0 ? "" : item.price}
                      onChange={(e) =>
                        handleUpdateItem(item.id, "price", parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>

                  <div className="col-span-1 md:col-span-2 space-y-1 md:text-right">
                    <label className="text-xs text-gray-500 dark:text-zinc-400 md:hidden">Total</label>
                    <div className="font-medium text-gray-800 dark:text-zinc-100 h-10 flex items-center md:justify-end">
                      ₹{itemTotal.toFixed(2)}
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-1 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-gray-400 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400"
                      onClick={() => handleRemoveItem(item.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 dark:border-zinc-800 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Discount (₹)</label>
          <Input
            type="number"
            step="0.01"
            min="0"
            max={subtotal}
            value={discount}
            onChange={(e) => setDiscount(Math.min(parseFloat(e.target.value) || 0, subtotal))}
            className="w-32"
            placeholder="0.00"
          />
        </div>
        <div className="text-2xl font-bold text-gray-800 dark:text-zinc-100">
          Total: ₹{total.toFixed(2)}
        </div>
        <Button
          type="submit"
          disabled={isLoading || items.length === 0 || !partyId}
          size="lg"
          className="w-full md:w-auto"
        >
          <Save className="w-5 h-5 mr-2" />
          {isLoading ? "Generating Bill..." : "Generate Bill"}
        </Button>
      </div>
    </form>
  );
}