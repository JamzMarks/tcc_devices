import { DeviceType } from "@Types/device.type";
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString } from "class-validator";

export interface DeviceDto {
  type: DeviceType;      
  deviceId: string;      
  macAddress?: string;
  ip?: string;
  deviceKey?: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  metadata?: Record<string, any>; 
}


export class DeviceGraphDto {
  @IsEnum(DeviceType)
  type: DeviceType;        

  @IsString()
  deviceId: string;      

  @IsOptional()
  @IsString()
  macAddress?: string;

  @IsOptional()
  @IsString()
  ip?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}