import { IsOptional, IsString, IsBoolean, IsInt, IsPositive } from 'class-validator';

export class SemaforoDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  id?: number;

  @IsString()
  macAddress: string;

  @IsString()
  deviceId: string;

  @IsString()
  ip: string;

  @IsString()
  deviceKey: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  createdAt?: Date;

  @IsOptional()
  updatedAt?: Date;

  @IsOptional()
  packId?: number | null;

  @IsOptional()
  subPackId?: number | null;
}
