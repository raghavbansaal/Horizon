import { getProducts } from "./actions";
import { ProductList } from "./product-list";
import { NextOrderList } from "./next-order-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getParties } from "../parties/actions";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const [productsRes, partiesRes] = await Promise.all([
    getProducts(),
    getParties(),
  ]);

  if (!productsRes.success) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-md">
        {productsRes.error || "Failed to load products"}
      </div>
    );
  }

  const products = productsRes.data || [];
  const suppliers = partiesRes.success && partiesRes.data
    ? partiesRes.data.filter((party) => party.type === "SUPPLIER")
    : [];

  const lowStockProducts = products.filter((p) => p.stock <= 10);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Products & Inventory</h2>
      </div>

      <Tabs defaultValue="products" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="products">Product Directory</TabsTrigger>
          <TabsTrigger value="order">Next Order List</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-6">
          <ProductList initialProducts={products} suppliers={suppliers} />
        </TabsContent>

        <TabsContent value="order" className="mt-6">
          <NextOrderList
            initialItems={lowStockProducts}
            allProducts={products}
            suppliers={suppliers}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}