import {
  IsString,
  IsNumber,
  IsEnum,
  IsArray,
  IsOptional,
  ValidateNested,
  IsUUID,
  IsISO8601,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from '@pos/shared-types';

export class CreateOrderItemDto {
  @IsUUID()
  productId: string;

  @IsString()
  sku: string;

  @IsString()
  name: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  taxRate?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discount?: number;
}

export class CreateOrderDto {
  @IsString()
  orderNumber: string;

  @IsString()
  posLocalId: string;

  @IsUUID()
  terminalId: string;

  @IsUUID()
  cashierId: string;

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  customerAddress?: string;

  @IsNumber()
  @Min(0)
  subtotal: number;

  @IsNumber()
  @Min(0)
  taxAmount: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discountAmount?: number;

  @IsNumber()
  @Min(0)
  totalAmount: number;

  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsUUID()
  @IsOptional()
  organizationId?: string;
}

export class UpdateOrderDto {
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discountAmount?: number;
}

export class SyncOrderDto {
  @IsString()
  @IsOptional()
  syncedAt?: string;
}

export class ExchangeReturnedItemDto {
  @IsString()
  productId: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsNumber()
  @Min(0)
  total: number;
}

export class ExchangeOrderDto {
  @IsString()
  newOrderPosLocalId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExchangeReturnedItemDto)
  returnedItems: ExchangeReturnedItemDto[];

  @IsNumber()
  @Min(0)
  creditAmount: number;

  @IsOptional()
  @IsISO8601()
  exchangedAt?: string;
}
