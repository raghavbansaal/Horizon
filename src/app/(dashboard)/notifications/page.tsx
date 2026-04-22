import { getNotifications } from "./actions";
import { format } from "date-fns";
import { AlertCircle, Bell, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const { data: notifications, error } = await getNotifications();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Notifications</h2>
      </div>

      {error ? (
        <div className="p-4 bg-red-50 text-red-600 rounded-md">
          {error}
        </div>
      ) : !notifications || notifications.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center py-16 text-gray-500">
          <Bell className="w-12 h-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">All Caught Up!</h3>
          <p>No alerts or irregular order patterns detected at the moment.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100">
          <div className="p-6 bg-gray-50/50">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <AlertCircle className="w-5 h-5 text-orange-500 mr-2" />
              Follow-up Required ({notifications.length})
            </h3>
            <p className="text-sm text-gray-500 mt-1 ml-7">
              These customers haven't placed an order within their usual timeframe.
            </p>
          </div>
          
          {notifications.map((notif) => (
            <div key={notif.id} className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors">
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  <div className="w-2 h-2 rounded-full bg-orange-500 mt-2"></div>
                </div>
                <div>
                  <h4 className="text-lg font-medium text-gray-900">
                    {notif.partyName}
                  </h4>
                  <div className="mt-1 text-sm text-gray-600 space-y-1">
                    <p>
                      Last order: <span className="font-medium text-gray-900">{format(new Date(notif.lastOrderDate), "dd MMM yyyy")}</span> ({notif.daysSinceLastOrder} days ago)
                    </p>
                    {notif.avgDaysBetweenOrders ? (
                      <p>
                        Usual order frequency: <span className="font-medium text-gray-900">Every ~{notif.avgDaysBetweenOrders} days</span>
                      </p>
                    ) : (
                      <p>Inactive new customer (ordered only once over 30 days ago)</p>
                    )}
                  </div>
                </div>
              </div>
              <Button render={<Link href={`/parties/${notif.partyId}`} />} variant="outline">
                View Details
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
