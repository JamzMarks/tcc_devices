import {
  IsOptional,
  IsString,
  IsPositive,
  IsInt,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SemaforoDto } from '@dtos/semaforos/semaforo.dto';

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
  slotStart:    number;
  @IsInt()
  slotDuration: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SemaforoDto) 
  semaforos: SemaforoDto[];
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
  @Type(() => SemaforoDto) 
  semaforos: SemaforoDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubPackDto) 
  subPacks: SubPackDto[];
}
