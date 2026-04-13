import { getExpenses } from "./actions";
import { ExpenseList } from "./expense-list";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { year, month } = await searchParams;
  const yearNum = year ? parseInt(year) : undefined;
  const monthNum = month ? parseInt(month) : undefined;

  const { data: expenses, error } = await getExpenses(yearNum, monthNum);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Expenses</h2>
      </div>

      {error ? (
        <div className="p-4 bg-red-50 text-red-600 rounded-md">
          {error}
        </div>
      ) : (
        <ExpenseList initialExpenses={expenses || []} />
      )}
    </div>
  );
}