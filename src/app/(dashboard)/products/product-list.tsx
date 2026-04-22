"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Product, Party } from "@prisma/client";
import { Plus, Edit, Trash2, Search, PackageOpen } from "lucide-react";
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
import { addProduct, deleteProduct, editProduct } from "./actions";

interface ProductListProps {
  initialProducts: Product[];
  suppliers: Party[];
}

export function ProductList({ initialProducts, suppliers }: ProductListProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "COW" | "BUFFALO">("ALL");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  const filteredProducts = products.filter((p) => {
    const matchesSearch = 
      p.name.toLowerCase().includes(search.toLowerCase()) || 
      p.variant.toLowerCase().includes(search.toLowerCase()) ||
      p.company.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === "ALL" || p.type === filterType;
    return matchesSearch && matchesType;
  });

  async function handleAdd(formData: FormData) {
    setIsLoading(true);
    const result = await addProduct(formData);
    if (result.success) {
      if ((result as any).data) {
        const added = (result as any).data as Product;
        setProducts((prev) =>
          [...prev, added].sort(
            (a, b) =>
              a.company.localeCompare(b.company) || a.name.localeCompare(b.name)
          )
        );
      }
      setIsAddOpen(false);
    } else {
      alert(result.error);
    }
    setIsLoading(false);
  }

  async function handleEdit(formData: FormData) {
    if (!editingProduct) return;
    setIsLoading(true);
    const result = await editProduct(editingProduct.id, formData);
    if (result.success) {
      if ((result as any).data) {
        const updated = (result as any).data as Product;
        setProducts((prev) =>
          prev
            .map((p) => (p.id === updated.id ? updated : p))
            .sort(
              (a, b) =>
                a.company.localeCompare(b.company) || a.name.localeCompare(b.name)
            )
        );
      }
      setEditingProduct(null);
    } else {
      alert(result.error);
    }
    setIsLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this product?")) return;
    setIsLoading(true);
    const result = await deleteProduct(id);
    if (result.success) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } else {
      alert(result.error);
    }
    setIsLoading(false);
  }

  return (
    <div className="bg-card text-card-foreground rounded-xl shadow-sm border border-border overflow-hidden">
      <div className="p-6 border-b border-border flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="flex gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={<Button className="w-full sm:w-auto" />}>
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
            </DialogHeader>
            <form action={handleAdd} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Product Name</label>
                <Input name="name"/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Input name="type" />
              </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Variant/Size</label>
                  <Input name="variant" required placeholder="e.g. 500ml" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Company/Brand</label>
                <Input name="company" required placeholder="Company Name" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Supplier</label>
                  <Select name="supplierId">
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">No supplier</SelectItem>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Carton Size (pcs)</label>
                  <Input
                    name="cartonSize"
                    type="number"
                    min="1"
                    required
                    defaultValue="1"
                    placeholder="e.g. 18"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Base Price (₹)</label>
                  <Input
                    name="basePrice"
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Initial Stock (pcs)</label>
                  <Input
                    name="stock"
                    type="number"
                    defaultValue="0"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save Product"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-foreground">Product Name</TableHead>
            <TableHead className="text-foreground">Variant</TableHead>
            <TableHead className="text-foreground">Company</TableHead>
            <TableHead className="text-right text-foreground">Base Price</TableHead>
            <TableHead className="text-right text-foreground">Stock</TableHead>
            <TableHead className="w-[100px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredProducts.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center py-8 text-muted-foreground"
              >
                <div className="flex flex-col items-center justify-center">
                  <PackageOpen className="w-8 h-8 text-muted-foreground mb-2" />
                  <p>No products found.</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            filteredProducts.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <div className="font-medium text-foreground">
                    {product.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span
                      className={`inline-block w-2 h-2 rounded-full mr-1 ${
                        product.type === "COW" ? "bg-yellow-400" : "bg-gray-800"
                      }`}
                    ></span>
                    {product.type}
                  </div>
                </TableCell>
                <TableCell className="text-foreground">
                  {product.variant}
                </TableCell>
                <TableCell className="text-foreground">
                  {product.company}
                </TableCell>
                <TableCell className="text-right font-medium">
                  ₹{product.basePrice.toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      product.stock <= 10
                        ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                        : "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300"
                    }`}
                  >
                    {product.stock}
                  </span>
                  <div className="text-xs text-muted-foreground mt-1">
                    {Math.floor(product.stock / Math.max(1, (product as any).cartonSize || 1))} cn •{" "}
                    {product.stock % Math.max(1, (product as any).cartonSize || 1)} pcs
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingProduct(product)}
                    >
                      <Edit className="w-4 h-4 text-gray-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(product.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingProduct}
        onOpenChange={(open) => !open && setEditingProduct(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <form action={handleEdit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Product Name</label>
                <Input
                  name="name"
                  required
                  defaultValue={editingProduct.name}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <Select name="type" required defaultValue={editingProduct.type}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COW">Cow</SelectItem>
                      <SelectItem value="BUFFALO">Buffalo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Variant/Size</label>
                  <Input
                    name="variant"
                    required
                    defaultValue={editingProduct.variant}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Company/Brand</label>
                <Input
                  name="company"
                  required
                  defaultValue={editingProduct.company}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Supplier</label>
                  <Select
                    name="supplierId"
                    defaultValue={editingProduct.supplierId || "__none"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">No supplier</SelectItem>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Carton Size (pcs)</label>
                  <Input
                    name="cartonSize"
                    type="number"
                    min="1"
                    required
                    defaultValue={(editingProduct as any).cartonSize || 1}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Base Price (₹)</label>
                  <Input
                    name="basePrice"
                    type="number"
                    step="0.01"
                    required
                    defaultValue={editingProduct.basePrice}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Stock (pcs)</label>
                  <Input
                    name="stock"
                    type="number"
                    defaultValue={editingProduct.stock}
                  />
                </div>
              </div>
              <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
