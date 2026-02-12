import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentEntity } from '../../entities/payment.entity';
import { OrderEntity } from '../../entities/order.entity';
import { CreatePaymentDto, UpdatePaymentDto, RefundPaymentDto } from './dto';
import { UserRole, PaymentStatus } from '@pos/shared-types';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(PaymentEntity)
    private paymentsRepository: Repository<PaymentEntity>,
    @InjectRepository(OrderEntity)
    private ordersRepository: Repository<OrderEntity>,
  ) {}

  async create(createPaymentDto: CreatePaymentDto, requestingUser: any) {
    const { orderId, organizationId } = createPaymentDto;

    // Verify order exists and belongs to user's organization
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Set organization from requesting user if not super admin
    if (requestingUser.role !== UserRole.SUPER_ADMIN) {
      if (order.organizationId !== requestingUser.organizationId) {
        throw new ForbiddenException(
          'Order does not belong to your organization',
        );
      }
      createPaymentDto.organizationId = requestingUser.organizationId;
    } else if (!organizationId) {
      createPaymentDto.organizationId = order.organizationId;
    }

    // Check if payment amount is valid
    if (createPaymentDto.amount > order.totalAmount) {
      throw new BadRequestException('Payment amount exceeds order total');
    }

    // Check if order is already fully paid
    const existingPayments = await this.paymentsRepository.find({
      where: { orderId, status: PaymentStatus.COMPLETED },
    });

    const totalPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0);
    if (totalPaid >= order.totalAmount) {
      throw new ConflictException('Order is already fully paid');
    }

    // Create payment
    const payment = this.paymentsRepository.create({
      ...createPaymentDto,
      status: createPaymentDto.status || PaymentStatus.PENDING,
    });

    return this.paymentsRepository.save(payment);
  }

  async findAll(
    requestingUser: any,
    filters?: { orderId?: string; terminalId?: string; status?: PaymentStatus },
  ) {
    const query = this.paymentsRepository
      .createQueryBuilder('payment')
      .orderBy('payment.createdAt', 'DESC');

    // Filter by organization for non-super-admins
    if (requestingUser.role !== UserRole.SUPER_ADMIN) {
      query.where('payment.organizationId = :orgId', {
        orgId: requestingUser.organizationId,
      });
    }

    // Apply additional filters
    if (filters?.orderId) {
      query.andWhere('payment.orderId = :orderId', {
        orderId: filters.orderId,
      });
    }

    if (filters?.terminalId) {
      query.andWhere('payment.terminalId = :terminalId', {
        terminalId: filters.terminalId,
      });
    }

    if (filters?.status) {
      query.andWhere('payment.status = :status', { status: filters.status });
    }

    return query.getMany();
  }

  async findOne(id: string, requestingUser: any) {
    const payment = await this.paymentsRepository.findOne({
      where: { id },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Check tenant access
    if (requestingUser.role !== UserRole.SUPER_ADMIN) {
      if (payment.organizationId !== requestingUser.organizationId) {
        throw new ForbiddenException('Access denied');
      }
    }

    return payment;
  }

  async update(
    id: string,
    updatePaymentDto: UpdatePaymentDto,
    requestingUser: any,
  ) {
    const payment = await this.findOne(id, requestingUser);

    // Only allow status and reference updates
    if (updatePaymentDto.status) {
      // Cannot change status of completed or refunded payments
      if (
        payment.status === PaymentStatus.COMPLETED ||
        payment.status === PaymentStatus.REFUNDED
      ) {
        throw new BadRequestException(
          `Cannot update ${payment.status.toLowerCase()} payment`,
        );
      }
      payment.status = updatePaymentDto.status;
    }

    if (updatePaymentDto.reference !== undefined) {
      payment.reference = updatePaymentDto.reference;
    }

    return this.paymentsRepository.save(payment);
  }

  async remove(id: string, requestingUser: any) {
    const payment = await this.findOne(id, requestingUser);

    // Only admins can delete payments
    if (
      requestingUser.role !== UserRole.SUPER_ADMIN &&
      requestingUser.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Insufficient permissions to delete payments',
      );
    }

    // Cannot delete completed or refunded payments
    if (
      payment.status === PaymentStatus.COMPLETED ||
      payment.status === PaymentStatus.REFUNDED
    ) {
      throw new BadRequestException(
        'Cannot delete completed or refunded payments',
      );
    }

    await this.paymentsRepository.remove(payment);
  }

  async refund(id: string, refundDto: RefundPaymentDto, requestingUser: any) {
    const payment = await this.findOne(id, requestingUser);

    // Only managers and admins can refund
    if (
      requestingUser.role !== UserRole.SUPER_ADMIN &&
      requestingUser.role !== UserRole.ADMIN &&
      requestingUser.role !== UserRole.MANAGER
    ) {
      throw new ForbiddenException(
        'Insufficient permissions to refund payments',
      );
    }

    // Can only refund completed payments
    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('Can only refund completed payments');
    }

    // Validate refund amount
    if (refundDto.amount > payment.amount) {
      throw new BadRequestException('Refund amount exceeds payment amount');
    }

    // Create refund payment record
    const refund = this.paymentsRepository.create({
      orderId: payment.orderId,
      terminalId: payment.terminalId,
      organizationId: payment.organizationId,
      method: payment.method,
      amount: -refundDto.amount, // Negative amount for refund
      status: PaymentStatus.REFUNDED,
      reference: `REFUND-${payment.id}`,
    });

    await this.paymentsRepository.save(refund);

    // Update original payment status if fully refunded
    if (refundDto.amount === payment.amount) {
      payment.status = PaymentStatus.REFUNDED;
      await this.paymentsRepository.save(payment);
    }

    return refund;
  }

  async getPaymentStats(requestingUser: any) {
    const query = this.paymentsRepository.createQueryBuilder('payment');

    // Filter by organization
    if (requestingUser.role !== UserRole.SUPER_ADMIN) {
      query.where('payment.organizationId = :orgId', {
        orgId: requestingUser.organizationId,
      });
    }

    const [totalPayments, completedPayments, totalRevenue, totalRefunds] =
      await Promise.all([
        query.getCount(),
        query
          .clone()
          .where('payment.status = :status', {
            status: PaymentStatus.COMPLETED,
          })
          .getCount(),
        query
          .clone()
          .select('SUM(payment.amount)', 'total')
          .where('payment.status = :status', {
            status: PaymentStatus.COMPLETED,
          })
          .andWhere('payment.amount > 0')
          .getRawOne()
          .then((result) => parseFloat(result?.total || 0)),
        query
          .clone()
          .select('SUM(ABS(payment.amount))', 'total')
          .where('payment.status = :status', { status: PaymentStatus.REFUNDED })
          .getRawOne()
          .then((result) => parseFloat(result?.total || 0)),
      ]);

    return {
      totalPayments,
      completedPayments,
      totalRevenue,
      totalRefunds,
      netRevenue: totalRevenue - totalRefunds,
    };
  }
}
