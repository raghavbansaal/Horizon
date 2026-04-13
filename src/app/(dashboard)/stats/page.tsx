import { getStats } from "./actions";
import { StatsDashboard } from "./stats-dashboard";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  // Load initial data for the current month
  const { data, error } = await getStats("monthly");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          Business Statistics
        </h2>
      </div>

      {error ? (
        <div className="p-4 bg-red-50 text-red-600 rounded-md dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : (
        <StatsDashboard initialData={data} />
      )}
    </div>
  );
}
