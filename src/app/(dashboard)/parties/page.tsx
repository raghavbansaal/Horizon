import { getParties } from "./actions";
import { PartyList } from "./party-list";

export default async function PartiesPage() {
  const result = await getParties();

  if (!result.success) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Parties Management</h2>
        </div>
        <div className="p-4 bg-red-50 text-red-600 rounded-md">
          {result.error || "Failed to load parties"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Parties Management</h2>
      </div>
      <PartyList initialParties={result.data} />
    </div>
  );
}