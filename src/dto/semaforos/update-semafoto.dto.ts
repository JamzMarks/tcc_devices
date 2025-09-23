// create-semaforo.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateSemaforoDto {
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @IsString()
  @IsNotEmpty()
  ip: string;

  @IsString()
  @IsNotEmpty()
  deviceKey: string;
}
