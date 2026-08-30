import {
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  ValidateNested,
  IsUUID,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReturnItemDto {
  @IsUUID()
  productId: string;

  @IsString()
  productName: string;

  @IsString()
  @IsOptional()
  productSku?: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitCost: number;

  // Accepted but ignored: the server always recomputes totalCost from
  // quantity * unitCost (see InventoryReturnsService.normalizeItems) so it
  // can never drift from client-side rounding/state. Declared here only so
  // the whitelisting ValidationPipe doesn't reject the field the frontend's
  // item editor naturally includes on each line item.
  @IsNumber()
  @IsOptional()
  totalCost?: number;
}

export class CreateInventoryReturnDto {
  @IsUUID()
  supplierId: string;

  @IsUUID()
  @IsOptional()
  deliveryId?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  returnedItems: ReturnItemDto[];

  @IsUUID()
  @IsOptional()
  organizationId?: string;
}

export class UpdateInventoryReturnDto {
  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @IsUUID()
  @IsOptional()
  deliveryId?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  @IsOptional()
  returnedItems?: ReturnItemDto[];
}

export class ResolveInventoryReturnDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  replacementItems: ReturnItemDto[];
}
