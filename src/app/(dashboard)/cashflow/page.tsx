import { getCashFlowData } from "./actions";
import { CashFlowManager } from "./cashflow-manager";

export const dynamic = "force-dynamic";

export default async function CashFlowPage() {
  const {
    success,
    cashFlows,
    transactions,
    parties,
    pendingReceivables,
    error,
  } = await getCashFlowData();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Cash & Bank Flow</h2>
      </div>

      {!success ? (
        <div className="p-4 bg-red-50 text-red-600 rounded-md">
          {error || "Failed to load cash flow data"}
        </div>
      ) : (
        <CashFlowManager
          cashFlows={cashFlows || []}
          transactions={transactions || []}
          parties={parties || []}
          pendingReceivables={pendingReceivables || 0}
        />
      )}
    </div>
  );
}