// One-time script to wipe all demo data from DevDhan.
// Run from project root with:
//   node scripts/reset-demo-data.js

/* eslint-disable no-console */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("Resetting DevDhan demo data...");

  await prisma.$transaction(async (tx) => {
    // Delete child records first to satisfy foreign keys
    await tx.salesItem.deleteMany({});
    await tx.purchaseItem.deleteMany({});
    await tx.priceList.deleteMany({});
    await tx.transaction.deleteMany({});
    await tx.expense.deleteMany({});

    await tx.salesBill.deleteMany({});
    await tx.purchaseBill.deleteMany({});

    await tx.product.deleteMany({});
    await tx.party.deleteMany({});

    // Reset cash/bank balances to zero but keep the rows
    await tx.cashFlow.updateMany({
      data: { balance: 0 },
    });
  });

  console.log("All demo data removed. Cash/Bank balances reset to 0.");
}

main()
  .catch((err) => {
    console.error("Failed to reset demo data:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

