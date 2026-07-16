import { IsNumber, IsOptional, IsString, IsDateString, Min } from 'class-validator';

export class CreateSupplierIncentiveDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsDateString()
  incentiveDate: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
