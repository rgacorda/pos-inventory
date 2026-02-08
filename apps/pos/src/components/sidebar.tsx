"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, Package, Receipt, LogOut } from "lucide-react";
import { useTodaysOrders } from "@/hooks/useDatabase";

export function Sidebar() {
  const pathname = usePathname();
  const todaysOrders = useTodaysOrders();

  const todaysSales =
    todaysOrders?.reduce((sum, order) => sum + (order.totalAmount || 0), 0) ||
    0;

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
