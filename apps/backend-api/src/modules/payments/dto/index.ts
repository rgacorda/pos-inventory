import {
  IsString,
  IsNumber,
  IsEnum,
  IsUUID,
  IsOptional,
  Min,
} from 'class-validator';
import { PaymentMethod, PaymentStatus } from '@pos/shared-types';

export class CreatePaymentDto {
  @IsUUID()
  orderId: string;

  @IsUUID()
  terminalId: string;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsEnum(PaymentStatus)
  @IsOptional()
  status?: PaymentStatus;

  @IsUUID()
  @IsOptional()
  organizationId?: string;
}

export class UpdatePaymentDto {
  @IsEnum(PaymentStatus)
  @IsOptional()
  status?: PaymentStatus;

  @IsString()
  @IsOptional()
  reference?: string;
}

export class RefundPaymentDto {
  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  @IsOptional()
  reason?: string;
}
