"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function getProducts() {
  const user = await getAuthenticatedUser();

  try {
    const products = await prisma.product.findMany({
      where: { userId: user.id },
      orderBy: [{ company: "asc" }, { name: "asc" }],
    });
    return { success: true, data: products };
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return { success: false, error: "Failed to fetch products" };
  }
}

export async function addProduct(formData: FormData) {
  const user = await getAuthenticatedUser();

  try {
    const name = formData.get("name") as string;
    const type = formData.get("type") as string;
    const variant = formData.get("variant") as string;
    const company = formData.get("company") as string;
    const supplierId = formData.get("supplierId") as string | null;
    const cartonSizeStr = formData.get("cartonSize") as string;
    const basePriceStr = formData.get("basePrice") as string;
    const stockStr = formData.get("stock") as string;

    if (!name || !type || !variant || !company || !basePriceStr) {
      return { success: false, error: "All required fields must be filled" };
    }

    const basePrice = parseFloat(basePriceStr);
    const stock = parseInt(stockStr || "0", 10);
    const cartonSize = Math.max(1, parseInt(cartonSizeStr || "1", 10) || 1);
    const normalizedSupplierId = supplierId && supplierId !== "__none" ? supplierId : null;

    if (normalizedSupplierId) {
      const supplier = await prisma.party.findFirst({
        where: { id: normalizedSupplierId, userId: user.id, type: "SUPPLIER" },
        select: { id: true },
      });
      if (!supplier) {
        return { success: false, error: "Invalid supplier selected" };
      }
    }

    const product = await prisma.product.create({
      data: {
        name,
        type,
        variant,
        company,
        cartonSize,
        basePrice,
        stock,
        supplierId: normalizedSupplierId,
        userId: user.id,
      },
    });

    const parties = await prisma.party.findMany({
      where: { userId: user.id },
    });
    if (parties.length > 0) {
      await prisma.priceList.createMany({
        data: parties.map(party => ({
          partyId: party.id,
          productId: product.id,
          price: basePrice,
          userId: user.id,
        }))
      });
    }

    revalidatePath("/products");
    return { success: true };
  } catch (error) {
    console.error("Failed to add product:", error);
    return { success: false, error: "Failed to add product" };
  }
}

export async function editProduct(id: string, formData: FormData) {
  const user = await getAuthenticatedUser();

  try {
    const name = formData.get("name") as string;
    const type = formData.get("type") as string;
    const variant = formData.get("variant") as string;
    const company = formData.get("company") as string;
    const basePriceStr = formData.get("basePrice") as string;
    const stockStr = formData.get("stock") as string;
    const supplierId = formData.get("supplierId") as string | null;
    const cartonSizeStr = formData.get("cartonSize") as string;
    
    const updateData: any = {};
    if (name) updateData.name = name;
    if (type) updateData.type = type;
    if (variant) updateData.variant = variant;
    if (company) updateData.company = company;
    if (cartonSizeStr) updateData.cartonSize = Math.max(1, parseInt(cartonSizeStr, 10) || 1);
    if (basePriceStr) updateData.basePrice = parseFloat(basePriceStr);
    if (stockStr) updateData.stock = parseInt(stockStr, 10);
    if (supplierId === "__none") {
      updateData.supplierId = null;
    } else if (supplierId !== null && supplierId !== "") {
      const supplier = await prisma.party.findFirst({
        where: { id: supplierId, userId: user.id, type: "SUPPLIER" },
        select: { id: true },
      });
      if (!supplier) {
        return { success: false, error: "Invalid supplier selected" };
      }
      updateData.supplierId = supplierId;
    }

    await prisma.product.updateMany({
      where: { id, userId: user.id },
      data: updateData,
    });

    revalidatePath("/products");
    return { success: true };
  } catch (error) {
    console.error("Failed to update product:", error);
    return { success: false, error: "Failed to update product" };
  }
}

export async function deleteProduct(id: string) {
  const user = await getAuthenticatedUser();

  try {
    await prisma.priceList.deleteMany({
      where: { productId: id, userId: user.id }
    });

    await prisma.product.deleteMany({
      where: { id, userId: user.id },
    });

    revalidatePath("/products");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete product:", error);
    return { success: false, error: "Failed to delete product. It may be linked to existing bills." };
  }
}