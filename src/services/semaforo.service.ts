import { SemafotoDto } from './../dto/semaforo.dto';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Registry } from 'azure-iothub';

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

  async getAllSemaforos() {
    return this.prisma.semaforo.findMany();
  }

  async getSemaforo(id: number) {
    const semaforo = await this.prisma.semaforo.findUnique({ where: { id } });
    if (!semaforo) throw new NotFoundException('Semáforo não encontrado');
    return semaforo;
  }

  async updateSemaforo(id: number, semafotoDto: Partial<SemafotoDto>) {
    const semaforo = await this.prisma.semaforo.findUnique({ where: { id } });
    if (!semaforo) throw new NotFoundException('Semáforo não encontrado');

    // Verifica duplicidade do MAC
    if (
      semafotoDto.macAddress &&
      semafotoDto.macAddress !== semaforo.macAddress
    ) {
      const exists = await this.prisma.semaforo.findUnique({
        where: { macAddress: semafotoDto.macAddress },
      });
      if (exists) throw new BadRequestException('MAC já está em uso');
    }

    return this.prisma.semaforo.update({
      where: { id },
      data: { ...semafotoDto },
    });
  }

  async deleteSemaforo(id: number) {
    const semaforo = await this.prisma.semaforo.findUnique({ where: { id } });
    if (!semaforo) throw new NotFoundException('Semáforo não encontrado');

    return this.prisma.semaforo.delete({ where: { id } });
  }

  async getByMacAdress(macAddress: string, ip: string) {
    const semaforo = await this.prisma.semaforo.findUnique({
      where: { macAddress },
    });
    if (!semaforo) throw new NotFoundException('Semáforo não encontrado');

    if (semaforo.ip != ip) {
      this.updateSemaforo(semaforo.id, {
        macAddress: semaforo.macAddress,
        ip: semaforo.ip,
      });
    }
  }
}
