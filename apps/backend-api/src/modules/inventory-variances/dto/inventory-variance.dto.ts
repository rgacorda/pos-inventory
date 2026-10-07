import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class VarianceCountItemDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(0)
  countedQuantity: number;
}

export class SaveInventoryVarianceDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VarianceCountItemDto)
  items: VarianceCountItemDto[];
}

export class ApplyInventoryVarianceDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  productIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  skipProductIds?: string[];
}
