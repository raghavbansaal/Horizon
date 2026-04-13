"use client";

import { useState } from "react";
import { Search, Save, RotateCcw, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { updatePriceList, resetPriceList } from "./actions";

interface ProductWithPrice {
  id: string;
  name: string;
  type: string;
  variant: string;
  company: string;
  basePrice: number;
  customPrice: number;
  hasCustomPrice: boolean;
}

interface PriceListManagerProps {
  partyId: string;
  initialProducts: ProductWithPrice[];
}

export function PriceListManager({ partyId, initialProducts }: PriceListManagerProps) {
  const [products, setProducts] = useState<ProductWithPrice[]>(initialProducts);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.variant.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSavePrice(productId: string) {
    const price = parseFloat(editValue);
    if (isNaN(price) || price < 0) {
      alert("Please enter a valid price");
      return;
    }

    setIsLoading(true);
    const result = await updatePriceList(partyId, productId, price);
    if (result.success) {
      setProducts(products.map(p => 
        p.id === productId 
          ? { ...p, customPrice: price, hasCustomPrice: true } 
          : p
      ));
      setEditingId(null);
    } else {
      alert(result.error);
    }
    setIsLoading(false);
  }

  async function handleResetPrice(productId: string, basePrice: number) {
    if (!confirm("Reset to base price?")) return;
    
    setIsLoading(true);
    const result = await resetPriceList(partyId, productId);
    if (result.success) {
      setProducts(products.map(p => 
        p.id === productId 
          ? { ...p, customPrice: basePrice, hasCustomPrice: false } 
          : p
      ));
    } else {
      alert(result.error);
    }
    setIsLoading(false);
  }

  return (
    <div>
      <div className="p-4 border-b border-gray-100 flex items-center gap-4 bg-gray-50/50">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Variant</TableHead>
            <TableHead className="text-right">Base Price</TableHead>
            <TableHead className="text-right">Party Price</TableHead>
            <TableHead className="w-[150px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredProducts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                No products found.
              </TableCell>
            </TableRow>
          ) : (
            filteredProducts.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <div className="font-medium">{product.name}</div>
                  <div className="text-xs text-gray-500">
                    <span
                      className={`inline-block w-2 h-2 rounded-full mr-1 ${
                        product.type === "COW" ? "bg-yellow-400" : "bg-gray-800"
                      }`}
                    ></span>
                    {product.type} • {product.company}
                  </div>
                </TableCell>
                <TableCell>{product.variant}</TableCell>
                <TableCell className="text-right text-gray-500">
                  ₹{product.basePrice.toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  {editingId === product.id ? (
                    <Input
                      type="number"
                      step="0.01"
                      className="w-24 ml-auto text-right h-8"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSavePrice(product.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                  ) : (
                    <span className={`font-medium ${product.hasCustomPrice ? "text-indigo-600" : "text-gray-900"}`}>
                      ₹{product.customPrice.toFixed(2)}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    {editingId === product.id ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-green-600"
                          onClick={() => handleSavePrice(product.id)}
                          disabled={isLoading}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400"
                          onClick={() => setEditingId(null)}
                          disabled={isLoading}
                        >
                          <span className="text-xl leading-none">&times;</span>
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => {
                            setEditingId(product.id);
                            setEditValue(product.customPrice.toString());
                          }}
                        >
                          Edit
                        </Button>
                        {product.hasCustomPrice && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-400 hover:text-orange-500"
                            title="Reset to base price"
                            onClick={() => handleResetPrice(product.id, product.basePrice)}
                            disabled={isLoading}
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        )}
                      </>
                    )}
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
