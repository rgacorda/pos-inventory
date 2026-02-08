"use client";

import { ColumnDef } from "@tanstack/react-table";
import { LocalOrder } from "@/lib/db";
import { formatCurrency, formatDateTime } from "@pos/shared-utils";

export const columns: ColumnDef<LocalOrder>[] = [
  {
    accessorKey: "orderNumber",
    header: "Transaction ID",
    cell: ({ row }) => (
      <span className="font-medium text-gray-900">
        {row.getValue("orderNumber")}
      </span>
    ),
  },
  {
    accessorKey: "localCreatedAt",
    header: "Date & Time",
    cell: ({ row }) => {
      const date = row.getValue("localCreatedAt") as Date;
      return (
        <span className="text-sm text-gray-600">{formatDateTime(date)}</span>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
            status === "COMPLETED"
              ? "bg-green-100 text-green-700"
              : status === "PENDING"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-gray-100 text-gray-700"
          }`}
        >
          {status}
        </span>
      );
    },
  },
  {
    accessorKey: "syncStatus",
    header: "Sync",
    cell: ({ row }) => {
      const syncStatus = row.getValue("syncStatus") as string;
      return (
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
            syncStatus === "synced"
              ? "bg-green-100 text-green-700"
              : syncStatus === "pending"
                ? "bg-yellow-100 text-yellow-700"
                : syncStatus === "error"
                  ? "bg-red-100 text-red-700"
                  : "bg-blue-100 text-blue-700"
          }`}
        >
          {syncStatus === "synced"
            ? "✓ Synced"
            : syncStatus === "pending"
              ? "⏳ Pending"
              : syncStatus === "error"
                ? "✗ Error"
                : "⟳ Syncing"}
        </span>
      );
    },
  },
  {
    accessorKey: "totalAmount",
    header: "Total",
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("totalAmount"));
      return (
        <span className="font-semibold text-gray-900">
          {formatCurrency(amount)}
        </span>
      );
    },
  },
];
