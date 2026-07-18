import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity } from '../../entities/order.entity';
import { InventoryDelivery } from '../../entities/inventory-delivery.entity';
import { Expense } from '../../entities/expense.entity';
import { OrderStatus } from '@pos/shared-types';

@Injectable()
export class FinancialsService {
  private readonly logger = new Logger(FinancialsService.name);

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
    this.logger.log(
      `Calculating P&L for org ${organizationId} from ${startDate} to ${endDate}`,
    );

    // Run all three aggregate queries in parallel
    const [revenueResult, cogsResult, expenseRows] = await Promise.all([
      // Revenue: SUM via SQL — no row hydration
      this.orderRepository
        .createQueryBuilder('order')
        .select('SUM(order.totalAmount)', 'total')
        .addSelect('COUNT(order.id)', 'count')
        .where('order.organizationId = :organizationId', { organizationId })
        .andWhere('order.status IN (:...statuses)', {
          statuses: [OrderStatus.COMPLETED, OrderStatus.SYNCED],
        })
        .andWhere(
          'COALESCE(order.completedAt, order.createdAt) BETWEEN :startDate AND :endDate',
          {
            startDate,
            endDate,
          },
        )
        .getRawOne(),

      // COGS: SUM via SQL
      this.deliveryRepository
        .createQueryBuilder('delivery')
        .select('SUM(delivery.totalCost)', 'total')
        .addSelect('COUNT(delivery.id)', 'count')
        .where('delivery.organizationId = :organizationId', { organizationId })
        .andWhere('delivery.status = :status', { status: 'RECEIVED' })
        .andWhere('delivery.deliveryDate BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        })
        .getRawOne(),

      // Expenses: GROUP BY type via SQL — single query instead of getMany + JS reduce
      this.expenseRepository
        .createQueryBuilder('expense')
        .select('expense.type', 'type')
        .addSelect('SUM(expense.amount)', 'total')
        .where('expense.organizationId = :organizationId', { organizationId })
        .andWhere('expense.expenseDate BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        })
        .groupBy('expense.type')
        .getRawMany(),
    ]);

    const revenue = parseFloat(revenueResult?.total || '0');
    const totalOrders = parseInt(revenueResult?.count || '0', 10);

    const cogs = parseFloat(cogsResult?.total || '0');
    const totalDeliveries = parseInt(cogsResult?.count || '0', 10);

    const expensesByType: Record<string, number> = {};
    let operatingExpenses = 0;
    for (const row of expenseRows) {
      const amount = parseFloat(row.total || '0');
      expensesByType[row.type] = amount;
      operatingExpenses += amount;
    }

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
