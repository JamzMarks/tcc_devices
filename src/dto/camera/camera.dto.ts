export interface CameraDto {
  id?: number;
  macAddress: string;
  deviceId: string;
  ip: string,
  deviceKey: string,
  isActive?: boolean;
  createdAt?: Date; 
  updatedAt?: Date;
}