import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Min,
  ValidateIf,
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

export class UpdateVarianceWindowDto {
  /** YYYY-MM-DD, or null together with endDate to close counting. */
  @ValidateIf((_, value) => value !== null)
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate: string | null;

  /** YYYY-MM-DD, or null together with startDate to close counting. */
  @ValidateIf((_, value) => value !== null)
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate: string | null;
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
