"use client";

import { ColumnDef } from "@tanstack/react-table";
import { LocalProduct } from "@/lib/db";

export const columns: ColumnDef<LocalProduct>[] = [
  {
    accessorKey: "sku",
    header: "SKU",
    cell: ({ row }) => (
      <span className="font-medium text-gray-900">{row.getValue("sku")}</span>
    ),
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <span className="font-medium text-gray-900">{row.getValue("name")}</span>
    ),
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => (
      <span className="text-gray-600 text-sm">
        {row.getValue("description")}
      </span>
    ),
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => (
      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
        {row.getValue("category")}
      </span>
    ),
  },
  {
    accessorKey: "price",
    header: "Price",
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("price"));
      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amount);
      return <span className="font-semibold text-gray-900">{formatted}</span>;
    },
  },
  {
    accessorKey: "stockQuantity",
    header: "Stock",
    cell: ({ row }) => {
      const stock = row.getValue("stockQuantity") as number;
      return (
        <span
          className={`font-medium ${
            stock === 0
              ? "text-red-600"
              : stock < 10
                ? "text-yellow-600"
                : "text-green-600"
          }`}
        >
          {stock}
        </span>
      );
    },
  },
];
