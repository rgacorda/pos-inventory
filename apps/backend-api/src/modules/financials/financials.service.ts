import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { OrderEntity } from '../../entities/order.entity';
import { InventoryDelivery } from '../../entities/inventory-delivery.entity';
import { Expense } from '../../entities/expense.entity';

@Injectable()
export class FinancialsService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(InventoryDelivery)
    private readonly deliveryRepository: Repository<InventoryDelivery>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
  ) {}

  async calculateProfitLoss(
    organizationId: string,
    startDate: string,
    endDate: string,
  ) {
    // Get revenue from completed orders
    const orders = await this.orderRepository
      .createQueryBuilder('order')
      .where('order.organizationId = :organizationId', { organizationId })
      .andWhere('order.status = :status', { status: 'COMPLETED' })
      .andWhere('order.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .getMany();

    const revenue = orders.reduce(
      (sum, order) => sum + Number(order.totalAmount),
      0,
    );
    const totalOrders = orders.length;

    // Get Cost of Goods Sold (COGS) from inventory deliveries
    const deliveries = await this.deliveryRepository
      .createQueryBuilder('delivery')
      .where('delivery.organizationId = :organizationId', { organizationId })
      .andWhere('delivery.status = :status', { status: 'RECEIVED' })
      .andWhere('delivery.deliveryDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .getMany();

    const cogs = deliveries.reduce(
      (sum, delivery) => sum + Number(delivery.totalCost),
      0,
    );
    const totalDeliveries = deliveries.length;

    // Get operating expenses
    const expenses = await this.expenseRepository
      .createQueryBuilder('expense')
      .where('expense.organizationId = :organizationId', { organizationId })
      .andWhere('expense.expenseDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .getMany();

    const operatingExpenses = expenses.reduce(
      (sum, expense) => sum + Number(expense.amount),
      0,
    );

    // Break down expenses by type
    const expensesByType = expenses.reduce(
      (acc, expense) => {
        const type = expense.type;
        if (!acc[type]) {
          acc[type] = 0;
        }
        acc[type] += Number(expense.amount);
        return acc;
      },
      {} as Record<string, number>,
    );

    // Calculate profitability metrics
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - operatingExpenses;
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return {
      period: {
        startDate,
        endDate,
      },
      revenue: {
        total: revenue,
        ordersCount: totalOrders,
      },
      cogs: {
        total: cogs,
        deliveriesCount: totalDeliveries,
      },
      operatingExpenses: {
        total: operatingExpenses,
        breakdown: expensesByType,
      },
      grossProfit,
      netProfit,
      metrics: {
        grossMargin: Number(grossMargin.toFixed(2)),
        netMargin: Number(netMargin.toFixed(2)),
      },
    };
  }

  async getFinancialSummary(organizationId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return this.calculateProfitLoss(
      organizationId,
      startOfMonth.toISOString(),
      endOfMonth.toISOString(),
    );
  }
}
