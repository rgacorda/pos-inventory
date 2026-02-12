import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  IsUUID,
} from 'class-validator';
import { ProductStatus } from '@pos/shared-types';

export class CreateProductDto {
  @IsString()
  sku: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  cost?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  taxRate?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  stockQuantity?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  lowStockThreshold?: number;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus;

  @IsUUID()
  @IsOptional()
  organizationId?: string;
}

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  cost?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  taxRate?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  stockQuantity?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  lowStockThreshold?: number;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus;
}
