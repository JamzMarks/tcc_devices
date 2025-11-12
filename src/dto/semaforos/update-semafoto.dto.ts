// create-semaforo.dto.ts
import { IsNumber, IsString, IsOptional } from 'class-validator';

export class UpdateSemaforoDto {
  
  @IsString()
  @IsOptional()
  ip: string;           
   
  @IsString()
  @IsOptional()
  macAddress: string;     

  @IsOptional()
  isActive: boolean;     
}


export class UpdateSemaforoPackDto {

  @IsString()
  @IsOptional()
  packId?: number | null;

  @IsNumber()
  @IsOptional()
  subPackId?: number | null;

}

export class UpdateSemaforoDeviceIdDto {
  @IsString()
  deviceId: string;   
}
