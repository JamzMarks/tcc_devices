import {
  IsOptional,
  IsString,
  IsPositive,
  IsInt,
  ValidateNested,
  IsArray,
  ArrayNotEmpty,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PackConfigDto {
  @IsInt()
  @IsPositive()
  cicle: number;
}
export class SemaforoPackDto {
  @IsString()
  id: string;

  @IsString()
  deviceId: string;

  @IsInt()
  @Min(0)
  green_duration: number;

  @IsInt()
  @Min(0)
  green_start: number;
}

export class SubPackDto {
  @IsOptional()
  @IsInt()
  id?: number;

  @IsOptional()
  @IsInt()
  packId?: number;

  @IsString()
  name: string;

  @IsInt()
  green_start: number;

  @IsInt()
  green_duration: number;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SemaforoPackDto)
  semaforos: SemaforoPackDto[];
}

export class PackDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  id?: number;

  @IsString()
  name: string;

  @ValidateNested()
  @Type(() => PackConfigDto)
  configs: PackConfigDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SemaforoPackDto)
  semaforos: SemaforoPackDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubPackDto)
  subPacks: SubPackDto[];
}


