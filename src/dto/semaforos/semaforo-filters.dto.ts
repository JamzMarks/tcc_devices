import {
  IsOptional,
  IsString,
  IsBoolean,
  IsPositive,
  IsInt,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class SemaforoFilters {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pack?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  subPack?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Max(100)
  limit: number = 20;
}
