import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Registry } from 'azure-iothub';

@Injectable()
export class CameraService {
   private registry: Registry;
  constructor(private prisma: PrismaService) {
    const connectionString = process.env.AZURE_IOTHUB_CONNECTION_STRING!;
    this.registry = Registry.fromConnectionString(connectionString);
  }

  async createCamera(macAddress: string, deviceId: string, ip: string) {
    const exists = await this.prisma.camera.findUnique({ where: { deviceId } });
    if (exists) {
      throw new BadRequestException('DeviceId already in use');
    }
    // let azureDevice;
    // try {
    //   azureDevice = await this.registry.create({ deviceId });
    // } catch (err) {
    //   throw new BadRequestException(
    //     'Erro ao criar device no Azure: ' + err.message,
    //   );
    // }
    try {
      const camera = await this.prisma.$transaction(async (tx) => {
        return tx.camera.create({
          data: {
            macAddress,
            deviceId,
            ip,
            deviceKey:
              deviceId + macAddress,
          },
        });
      });
      return camera;
    } catch (err) {
      // await this.registry.delete(deviceId);
      throw new BadRequestException(
        'Erro ao salvar no banco, dispositivo Azure removido: ' + err.message,
      );
    }
    
  }

  async getAllCameras() {
    return this.prisma.camera.findMany();
  }

  async getCamera(id: number) {
    const camera = await this.prisma.camera.findUnique({ where: { id } });
    if (!camera) throw new NotFoundException('Camera não encontrada');
    return camera;
  }

  async updateCamera(id: number, macAddress?: string, deviceId?: string, isActive?: boolean) {
    const camera = await this.prisma.camera.findUnique({ where: { id } });
    if (!camera) throw new NotFoundException('Camera não encontrada');

    // Se atualizar MAC, verificar duplicidade
    if (macAddress && macAddress !== camera.macAddress) {
      const exists = await this.prisma.camera.findFirst({ where: { macAddress } });
      if (exists) throw new BadRequestException('MAC já está em uso');
    }

    return this.prisma.camera.update({
      where: { id },
      data: {
        macAddress,
        deviceId,
        isActive,
      },
    });
  }

  async deleteCamera(id: number) {
    const camera = await this.prisma.camera.findUnique({ where: { id } });
    if (!camera) throw new NotFoundException('Camera não encontrada');

    return this.prisma.camera.delete({ where: { id } });
  }
}
