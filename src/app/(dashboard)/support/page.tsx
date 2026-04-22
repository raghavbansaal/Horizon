import { SupportManager } from "./support-manager";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">IT Support</h2>
      </div>
      <SupportManager />
    </div>
  );
}
