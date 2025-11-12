import { SemaforoDto } from '../dto/semaforos/semaforo.dto';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Registry } from 'azure-iothub';
import { SemaforoFilters } from '@dtos/semaforos/semaforo-filters.dto';
import { DeviceType } from 'generated/prisma';
import { isValidIP } from '@utils/isValidIP';
import { SharedAccessSignature } from 'azure-iothub';
import * as crypto from 'crypto';
import { UpdateSemaforoDto } from '@dtos/semaforos/update-semafoto.dto';
@Injectable()
export class SemaforoService {
  private registry: Registry;
  private readonly iotHubHostName: string = process.env.IOT_HUB_HOST!;

  constructor(private prisma: PrismaService) {
    const connectionString = process.env.AZURE_IOTHUB_CONNECTION_STRING!;
    this.registry = Registry.fromConnectionString(connectionString);
  }

  async createSemaforo(macAddress: string, deviceId: string, ip: string) {
    const exists = await this.prisma.semaforo.findUnique({
      where: { macAddress },
    });
    if (exists)
      throw new BadRequestException('Semáforo com esse MAC já existe');
    if (!isValidIP(ip))
      throw new BadRequestException('Endereço de IP não é válido');

    let azureDevice;
    try {
      azureDevice = await this.registry.create({ deviceId });
    } catch (err) {
      throw new BadRequestException(
        'Erro ao criar device no Azure: ' + err.message,
      );
    }
    try {
      const semaforo = await this.prisma.$transaction(async (tx) => {
        return tx.semaforo.create({
          data: {
            macAddress,
            deviceId,
            ip,
            deviceKey:
              azureDevice.responseBody.authentication.symmetricKey.primaryKey,
          },
        });
      });
      return semaforo;
    } catch (err) {
      await this.registry.delete(deviceId);
      throw new BadRequestException(
        'Erro ao salvar no banco, dispositivo Azure removido: ' + err.message,
      );
    }
  }

  async getAllSemaforos(filters: SemaforoFilters) {
    const { query, subPack, isActive, pack, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const queryData = [
      query
        ? {
            OR: [
              { macAddress: { contains: query } },
              { ip: { contains: query } },
              { deviceId: { contains: query } },
            ],
          }
        : {},
      subPack ? { subPackId: subPack } : {},
      pack ? { packId: pack } : {},
      isActive != undefined ? { isActive } : {},
    ];
    const [semaforos, total] = await Promise.all([
      this.prisma.semaforo.findMany({
        where: {
          AND: queryData,
        },
        skip,
        take: limit,
      }),
      this.prisma.semaforo.count({
        where: {
          AND: queryData,
        },
      }),
    ]);
    return { data: semaforos, total, page, limit };
  }

  async getSemaforo(id: number) {
    const semaforo = await this.prisma.semaforo.findUnique({ where: { id } });
    if (!semaforo) throw new NotFoundException('Semáforo não encontrado');
    return semaforo;
  }

  async updateSemaforo(id: number, SemaforoDto: Partial<UpdateSemaforoDto>) {
    const semaforo = await this.prisma.semaforo.findUnique({ where: { id } });
    if (!semaforo) throw new NotFoundException('Semáforo não encontrado');

    if (
      SemaforoDto.macAddress &&
      SemaforoDto.macAddress !== semaforo.macAddress
    ) {
      const exists = await this.prisma.semaforo.findUnique({
        where: { macAddress: SemaforoDto.macAddress },
      });
      if (exists) throw new BadRequestException('MAC já está em uso');
    }
    const updated = this.prisma.semaforo.update({
      where: { id },
      data: { ...SemaforoDto, updatedAt: new Date() },
    });
    return updated;
  }

  async updateSemaforoDeviceId(id: number, newDeviceId: string) {
    const semaforo = await this.prisma.semaforo.findUnique({
      where: { id },
    });
    if (!semaforo) {
      throw new NotFoundException('Semáforo não encontrado');
    }
    let azureDevice;
    try {
      azureDevice = await this.registry.create({ deviceId: newDeviceId });
    } catch (err) {
      throw new BadRequestException(
        'Erro ao criar novo device no Azure: ' + err.message,
      );
    }
    try {
      const updatedSemaforo = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.semaforo.update({
          where: { id },
          data: {
            deviceId: newDeviceId,
            deviceKey:
              azureDevice.responseBody.authentication.symmetricKey.primaryKey,
          },
        });
        return updated;
      });

      await this.registry.delete(semaforo.deviceId);

      return updatedSemaforo;
    } catch (err) {
      await this.registry.delete(newDeviceId);
      throw new BadRequestException(
        'Erro ao atualizar no banco. Novo device removido do Azure: ' +
          err.message,
      );
    }
  }

  async deleteSemaforo(id: number) {
    const semaforo = await this.prisma.semaforo.findUnique({ where: { id } });
    if (!semaforo) {
      throw new NotFoundException('Semáforo não encontrado');
    }

    await this.prisma.semaforo.delete({ where: { id } });

    try {
      await this.registry.delete(semaforo.deviceId);
    } catch (err) {
      console.error(
        `Falha ao excluir device ${semaforo.deviceId} do Azure:`,
        err,
      );

      await this.prisma.pendingDeletionDevice.create({
        data: {
          deviceId: semaforo.deviceId,
          resource: DeviceType.Semaforo,
          error: err.message,
        },
      });
    }
  }

  async getByMacAdress(macAddress: string) {
    const semaforo = await this.prisma.semaforo.findUnique({
      where: { macAddress },
    });

    if (!semaforo) throw new NotFoundException('Semáforo não encontrado');

    const sasToken = this.generateSasToken(
      process.env.AZURE_IOTHUB_HOSTNAME!,
      semaforo.deviceId,
      semaforo.deviceKey,
      60 * 60, // 1 hora
    );

    return {
      ...semaforo,
      iotHubHost: this.iotHubHostName,
      sasToken,
    };
  }

  async findManyByIds(ids: number[]) {
    try {
      const semaforos = await this.prisma.semaforo.findMany({
        where: {
          id: { in: ids },
        },
      });
      if (semaforos.length === 0) {
        throw new NotFoundException(
          'Nenhum semáforo encontrado para os IDs informados.',
        );
      }
      return semaforos;
    } catch (error) {
      throw new Error(error);
    }
  }

  private generateSasToken(
    iotHubHostName: string,
    deviceId: string,
    deviceKey: string,
    ttlSeconds: number,
  ): string {
    const resourceUri = `${iotHubHostName}/devices/${deviceId}`;
    const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;

    const stringToSign = encodeURIComponent(resourceUri) + '\n' + expiry;
    const hmac = crypto.createHmac('sha256', Buffer.from(deviceKey, 'base64'));
    hmac.update(stringToSign);
    const signature = hmac.digest('base64');

    return `SharedAccessSignature sr=${encodeURIComponent(
      resourceUri,
    )}&sig=${encodeURIComponent(signature)}&se=${expiry}`;
  }
}
