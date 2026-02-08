"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart,
  Package,
  Receipt,
  LogOut,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { useTodaysOrders } from "@/hooks/useDatabase";
import { useState, useEffect } from "react";
import { dbHelpers } from "@/lib/db";
import { syncService } from "@/lib/api-client";
import { toast } from "sonner";

export function Sidebar() {
  const pathname = usePathname();
  const todaysOrders = useTodaysOrders();
  const [failedCount, setFailedCount] = useState({
    failed: 0,
    pending: 0,
    total: 0,
  });
  const [isRetrying, setIsRetrying] = useState(false);

  const todaysSales =
    todaysOrders?.reduce((sum, order) => sum + (order.totalAmount || 0), 0) ||
    0;

  // Check for failed items on mount and periodically
  useEffect(() => {
    const checkFailedItems = async () => {
      const counts = await dbHelpers.getFailedItemsCount();
      setFailedCount(counts);
    };

    checkFailedItems();
    const interval = setInterval(checkFailedItems, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const handleRetrySync = async () => {
    setIsRetrying(true);
    try {
      const success = await syncService.retryFailedSync();
      if (success) {
        toast.success("Sync Retry Successful", {
          description: "All pending and failed transactions have been synced.",
        });
        // Refresh counts
        const counts = await dbHelpers.getFailedItemsCount();
        setFailedCount(counts);
      } else {
        toast.error("Sync Retry Failed", {
          description: "Unable to sync. Check your connection and try again.",
        });
      }
    } catch (error) {
      toast.error("Sync Error", {
        description: "An error occurred while retrying sync.",
      });
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="flex w-64 flex-col border-r bg-white">
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">🏪 AR-POS</h2>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <div className="space-y-2">
          <Link href="/">
            <div
              className={`flex items-center gap-3 rounded-lg p-3 transition-colors ${
                pathname === "/"
                  ? "border-l-4 border-gray-900 bg-gray-50 text-gray-900 font-medium"
                  : "hover:bg-gray-100 text-gray-700 border-l-4 border-transparent"
              }`}
            >
              <ShoppingCart className="h-5 w-5" />
              <span className="text-sm">Point of Sale</span>
            </div>
          </Link>
          <Link href="/transactions">
            <div
              className={`flex items-center gap-3 rounded-lg p-3 transition-colors ${
                pathname === "/transactions"
                  ? "border-l-4 border-gray-900 bg-gray-50 text-gray-900 font-medium"
                  : "hover:bg-gray-100 text-gray-700 border-l-4 border-transparent"
              }`}
            >
              <Receipt className="h-5 w-5" />
              <span className="text-sm">Transactions</span>
            </div>
          </Link>
          <Link href="/products">
            <div
              className={`flex items-center gap-3 rounded-lg p-3 transition-colors ${
                pathname === "/products"
                  ? "border-l-4 border-gray-900 bg-gray-50 text-gray-900 font-medium"
                  : "hover:bg-gray-100 text-gray-700 border-l-4 border-transparent"
              }`}
            >
              <Package className="h-5 w-5" />
              <span className="text-sm">Products</span>
            </div>
          </Link>
        </div>
      </nav>

      <div className="border-t p-4">
        {/* Sync Status - Only show for errors, not pending */}
        {failedCount.failed > 0 && (
          <div className="mb-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-2">
              <div className="flex items-start gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-red-900">
                    {failedCount.failed} Failed Sync
                    {failedCount.failed > 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-red-700 mt-0.5">
                    Transactions need to be retried
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleRetrySync}
                disabled={isRetrying}
                className="w-full bg-red-600 hover:bg-red-700 text-white"
              >
                {isRetrying ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Retry Sync
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        <Link href="/login">
          <div className="hover:bg-gray-100 hover:text-gray-900 flex cursor-pointer items-center gap-3 rounded-lg p-3 text-gray-700 transition-colors">
            <LogOut className="h-5 w-5" />
            <span className="text-sm">Logout</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
