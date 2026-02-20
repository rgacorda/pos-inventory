"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ShoppingCart,
  Package,
  Receipt,
  LogOut,
  RefreshCw,
  AlertCircle,
  Settings,
} from "lucide-react";
import { useTodaysOrders } from "@/hooks/useDatabase";
import { useState, useEffect } from "react";
import { dbHelpers } from "@/lib/db";
import { syncService, apiClient } from "@/lib/api-client";
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
  const [terminalId, setTerminalId] = useState<string>("");
  const [newTerminalId, setNewTerminalId] = useState<string>("");
  const [isTerminalDialogOpen, setIsTerminalDialogOpen] = useState(false);
  const [availableTerminals, setAvailableTerminals] = useState<any[]>([]);
  const [isLoadingTerminals, setIsLoadingTerminals] = useState(false);

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

  // Load terminal ID on mount
  useEffect(() => {
    const loadTerminalId = async () => {
      const id = await dbHelpers.getTerminalId();
      setTerminalId(id || "Not Set");
      setNewTerminalId(id || "");
    };
    loadTerminalId();
  }, []);

  // Fetch available terminals when dialog opens
  useEffect(() => {
    if (isTerminalDialogOpen) {
      const fetchTerminals = async () => {
        setIsLoadingTerminals(true);
        try {
          const terminals = await apiClient.getTerminals();
          setAvailableTerminals(terminals);
        } catch (error) {
          console.error("Failed to fetch terminals:", error);
          toast.error("Failed to load terminals", {
            description: "Unable to fetch available terminals from server.",
          });
        } finally {
          setIsLoadingTerminals(false);
        }
      };
      fetchTerminals();
    }
  }, [isTerminalDialogOpen]);

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

  const handleSaveTerminalId = async () => {
    if (!newTerminalId.trim()) {
      toast.error("Terminal ID Required", {
        description: "Please enter a valid terminal ID.",
      });
      return;
    }
    try {
      await dbHelpers.setTerminalId(newTerminalId.trim());
      setTerminalId(newTerminalId.trim());
      setIsTerminalDialogOpen(false);
      toast.success("Terminal ID Updated", {
        description: `Terminal ID set to: ${newTerminalId.trim()}`,
      });
    } catch (error) {
      toast.error("Update Failed", {
        description: "Unable to update terminal ID.",
      });
    }
  };

  return (
    <div className="flex w-64 flex-col border-r bg-white">
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">🏪 AR-POS</h2>
        </div>
        <div className="flex items-center justify-between text-xs">
          <div className="flex-1 min-w-0">
            <p className="text-gray-500 mb-0.5">Terminal:</p>
            <p className="text-gray-900 font-mono font-medium truncate">
              {terminalId}
            </p>
          </div>
          <Dialog
            open={isTerminalDialogOpen}
            onOpenChange={setIsTerminalDialogOpen}
          >
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 ml-2 flex-shrink-0"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Set Terminal ID</DialogTitle>
                <DialogDescription>
                  Select a registered terminal for this device.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                {isLoadingTerminals ? (
                  <div className="text-center text-gray-500 py-4">
                    Loading terminals...
                  </div>
                ) : availableTerminals.length === 0 ? (
                  <div className="text-center text-gray-500 py-4">
                    <p className="text-sm mb-2">No terminals registered</p>
                    <p className="text-xs">
                      Please contact administrator to register terminals
                    </p>
                  </div>
                ) : (
                  <Select
                    value={newTerminalId}
                    onValueChange={setNewTerminalId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a terminal" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTerminals.map((terminal) => (
                        <SelectItem
                          key={terminal.id}
                          value={terminal.terminalId}
                        >
                          {terminal.terminalId}
                          {terminal.location && ` - ${terminal.location}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsTerminalDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveTerminalId}
                  disabled={!newTerminalId || availableTerminals.length === 0}
                >
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
