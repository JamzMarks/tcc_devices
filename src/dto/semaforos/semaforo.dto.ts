import { IsOptional, IsString, IsBoolean, IsInt, IsPositive } from 'class-validator';

export class SemaforoDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  id: string;

  @IsString()
  macAddress: string;

  @IsString()
  deviceId: string;

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

  @IsInt()
  slotStart?: number;

  @IsInt()
  slotDuration?: number;
}

// (:Semaforo {
//   id: <int>,
//   macAddress: <string>,
//   deviceId: <string>,
//   deviceKey: <string>,
//   isActive: <boolean>,
//   slotStart: <int>,
//   slotDuration: <int>,
//   createdAt: <datetime>,
//   updatedAt: <datetime>
// })