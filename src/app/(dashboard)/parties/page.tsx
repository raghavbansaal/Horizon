import { getParties } from "./actions";
import { PartyList } from "./party-list";

export default async function PartiesPage() {
  const { data: parties, error } = await getParties();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Parties Management</h2>
      </div>

      {error ? (
        <div className="p-4 bg-red-50 text-red-600 rounded-md">
          {error}
        </div>
      ) : (
        <PartyList initialParties={parties || []} />
      )}
    </div>
  );
}
