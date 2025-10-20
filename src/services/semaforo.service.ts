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

@Injectable()
export class SemaforoService {
  private registry: Registry;
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

  async updateSemaforo(id: number, SemaforoDto: Partial<SemaforoDto>) {
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
    const { id: semaforoId, createdAt, ...allowedData } = SemaforoDto;
    return this.prisma.semaforo.update({
      where: { id },
      data: { ...allowedData },
    });
  }

  async deleteSemaforo(id: number) {
    const semaforo = await this.prisma.semaforo.findUnique({ where: { id } });
    if (!semaforo) throw new NotFoundException('Semáforo não encontrado');

    await this.prisma.semaforo.delete({ where: { id } });

    try {
      await this.registry.delete(semaforo.deviceId);
    } catch (err) {
      await this.prisma.pendingDeletionDevice.create({
        data: {
          deviceId: semaforo.deviceId,
          resource: DeviceType.Semaforo,
        },
      });
    }
  }

  async getByMacAdress(macAddress: string, ip: string) {
    const semaforo = await this.prisma.semaforo.findUnique({
      where: { macAddress },
    });
    if (!semaforo) throw new NotFoundException('Semáforo não encontrado');
    return semaforo;
    // if (semaforo.ip != ip) {
    //   this.updateSemaforo(semaforo.id, {
    //     macAddress: semaforo.macAddress,
    //     ip: semaforo.ip,
    //   });
    // }
  }

}
