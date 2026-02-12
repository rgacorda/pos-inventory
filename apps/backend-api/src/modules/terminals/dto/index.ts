import { IsString, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class CreateTerminalDto {
  @IsString()
  terminalId: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsUUID()
  @IsOptional()
  organizationId?: string;
}

export class UpdateTerminalDto {
  @IsString()
  @IsOptional()
  terminalId?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
