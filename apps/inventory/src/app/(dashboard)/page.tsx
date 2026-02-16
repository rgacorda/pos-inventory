"use client";

import { useEffect, useState } from "react";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { DataTable } from "@/components/data-table";
import { SectionCards } from "@/components/section-cards";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

export default function Page() {
  const [stats, setStats] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load all dashboard data in parallel
      const [
        productsData,
        usersData,
        orderStatsData,
        paymentsStatsData,
        ordersData,
      ] = await Promise.all([
        apiClient.getProducts(),
        apiClient.getUsers(),
        apiClient.getOrderStats(),
        apiClient.getPaymentStats(),
        apiClient.getOrders(),
      ]);

      // Calculate stats
      const totalProducts = productsData.length;
      const activeProducts = productsData.filter((p: any) => p.isActive).length;
      const totalUsers = usersData.length;

      const statsData = {
        netRevenue: paymentsStatsData?.totalRevenue || 0,
        totalProducts,
        activeProducts,
        totalOrders: orderStatsData?.totalOrders || 0,
        completedOrders: orderStatsData?.completedOrders || 0,
        totalUsers,
      };

      setStats(statsData);
      setOrders(ordersData.slice(0, 10)); // Show only last 10 orders
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <>
      <SectionCards stats={stats} />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>
      {/* <DataTable data={orders} /> */}
    </>
  );
}
