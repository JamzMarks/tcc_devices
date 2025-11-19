import {
  IsOptional,
  IsString,
  IsPositive,
  IsInt,
  ValidateNested,
  IsArray,
  ArrayNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PackConfigDto {
  @IsInt()
  @IsPositive()
  cicle: number;
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
  slotStart: number;

  @IsInt()
  slotDuration: number;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  semaforos: string[];
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
  @IsString({ each: true }) 
  semaforos: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubPackDto)
  subPacks: SubPackDto[];
}
