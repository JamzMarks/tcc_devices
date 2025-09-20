import {
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  IsPositive,
  IsInt,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class SemafotoFilters {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  pack?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  subPack?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number = 20;
}
