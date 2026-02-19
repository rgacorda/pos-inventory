import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from '../../entities/expense.entity';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
  ) {}

  async findAll(
    organizationId: string,
    filters?: { startDate?: string; endDate?: string; type?: string },
  ) {
    const queryBuilder = this.expenseRepository
      .createQueryBuilder('expense')
      .where('expense.organizationId = :organizationId', { organizationId })
      .orderBy('expense.expenseDate', 'DESC');

    if (filters?.startDate && filters?.endDate) {
      queryBuilder.andWhere(
        'expense.expenseDate BETWEEN :startDate AND :endDate',
        {
          startDate: filters.startDate,
          endDate: filters.endDate,
        },
      );
    }

    if (filters?.type) {
      queryBuilder.andWhere('expense.type = :type', { type: filters.type });
    }

    return queryBuilder.getMany();
  }

  async findOne(id: string, organizationId: string) {
    const expense = await this.expenseRepository.findOne({
      where: { id, organizationId },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    return expense;
  }

  async create(createDto: any) {
    const expense = this.expenseRepository.create(createDto);
    return this.expenseRepository.save(expense);
  }

  async update(id: string, organizationId: string, updateDto: any) {
    const expense = await this.findOne(id, organizationId);
    Object.assign(expense, updateDto);
    return this.expenseRepository.save(expense);
  }

  async delete(id: string, organizationId: string) {
    const expense = await this.findOne(id, organizationId);
    await this.expenseRepository.remove(expense);
    return { message: 'Expense deleted successfully' };
  }

  async getStats(
    organizationId: string,
    filters?: { startDate?: string; endDate?: string },
  ) {
    const queryBuilder = this.expenseRepository
      .createQueryBuilder('expense')
      .where('expense.organizationId = :organizationId', { organizationId });

    if (filters?.startDate && filters?.endDate) {
      queryBuilder.andWhere(
        'expense.expenseDate BETWEEN :startDate AND :endDate',
        {
          startDate: filters.startDate,
          endDate: filters.endDate,
        },
      );
    }

    const expenses = await queryBuilder.getMany();

    const totalExpenses = expenses.reduce(
      (sum, e) => sum + Number(e.amount),
      0,
    );

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

    return {
      totalExpenses,
      expensesByType,
      totalCount: expenses.length,
    };
  }
}
