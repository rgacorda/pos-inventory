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
                  ? "bg-blue-50 text-blue-600 font-medium"
                  : "hover:bg-gray-100 text-gray-700"
              }`}
            >
              <ShoppingCart className="h-5 w-5" />
              <span className="text-sm">Point of Sale</span>
            </div>
          </Link>
          <Link href="/orders">
            <div
              className={`flex items-center gap-3 rounded-lg p-3 transition-colors ${
                pathname === "/orders"
                  ? "bg-blue-50 text-blue-600 font-medium"
                  : "hover:bg-gray-100 text-gray-700"
              }`}
            >
              <Receipt className="h-5 w-5" />
              <span className="text-sm">Orders</span>
            </div>
          </Link>
          <Link href="/products">
            <div
              className={`flex items-center gap-3 rounded-lg p-3 transition-colors ${
                pathname === "/products"
                  ? "bg-blue-50 text-blue-600 font-medium"
                  : "hover:bg-gray-100 text-gray-700"
              }`}
            >
              <Package className="h-5 w-5" />
              <span className="text-sm">Products</span>
            </div>
          </Link>
        </div>

        <Separator className="my-4" />

        <div className="space-y-2">
          <Link href="/login">
            <div className="hover:bg-red-50 hover:text-red-600 flex cursor-pointer items-center gap-3 rounded-lg p-3 text-gray-700 transition-colors">
              <LogOut className="h-5 w-5" />
              <span className="text-sm">Logout</span>
            </div>
          </Link>
        </div>
      </nav>


    </div>
  );
}
