export interface SemaforoDto {
  id?: number;
  macAddress: string;
  deviceId: string;
  ip: string,
  deviceKey: string,
  isActive?: boolean;
  createdAt?: Date; 
  updatedAt?: Date;
  packId?: number | null;
  subPackId?: number | null;
}
