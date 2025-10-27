import { SemaforoService } from 'src/services/semaforo.service';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PackDto } from '@dtos/pack/pack.dto';

@Injectable()
export class PackService {
  constructor(
    private prisma: PrismaService,
    private readonly semaforoService: SemaforoService,
  ) {}

  /**
   * Cria um Pack com semáforos associados
   * @param name nome do pack
   * @param semaforoIds array de IDs de semáforos
   */
  async createPack(data: PackDto) {
    const { name, semaforos, subPacks, configs } = data;

    if (semaforos.length < 2 && subPacks.length === 0) {
      throw new BadRequestException(
        'Um Pack precisa ter pelo menos 2 semáforos ou 1 SubPack.',
      );
    }
    const semaforosIds: number[] = semaforos.map(s => s.id!) 
    return this.prisma.$transaction(async (tx) => {
      if (semaforos.length > 0) {
        
        const existingSemaforos =
          await this.semaforoService.findManyByIds(semaforosIds);

        if (existingSemaforos.length !== semaforos.length) {
          throw new BadRequestException(
            'Um ou mais semáforos informados não existem.',
          );
        }
      }
      const pack = await tx.pack.create({
        data: {
          name,
          cicle: configs.cicle,
          ...(semaforosIds.length > 0 && {
            semaforos: {
              connect: semaforosIds.map((id) => ({ id })),
            },
          }),
        },
      });

      if (subPacks.length > 0) {
        for (const sub of subPacks) {
          if (sub.semaforos.length < 2) {
            throw new BadRequestException(
              'Cada SubPack precisa de pelo menos 2 semáforos.',
            );
          }
          const semaforosPackIds: number[] = sub.semaforos.map(s => s.id!) 
          const existingSubSemaforos = await this.semaforoService.findManyByIds(
            semaforosPackIds
          );

          if (existingSubSemaforos.length !== sub.semaforos.length) {
            throw new BadRequestException(
              'Um ou mais semáforos do SubPack não existem.',
            );
          }

          await tx.subPack.create({
            data: {
              packId: pack.id,
              semaforos: {
                connect: sub.semaforos.map(({id}) => ({ id })),
              },
            },
          });
        }
      }

      return tx.pack.findUnique({
        where: { id: pack.id },
        include: {
          semaforos: true,
          subPacks: { include: { semaforos: true } },
        },
      });
    });
  }

  async getAllPacks() {
    return this.prisma.pack.findMany({
      include: {
        subPacks: true,
        semaforos: true,
      },
    });
  }

  async getPack(id: number) {
    const pack = await this.prisma.pack.findUnique({
      where: { id },
      include: { semaforos: true },
    });
    if (!pack) {
      throw new NotFoundException('Pack não encontrado');
    }
    return pack;
  }

  async updatePack(id: number, semaforoIds?: number[]) {
    const pack = await this.prisma.pack.findUnique({ where: { id } });
    if (!pack) throw new NotFoundException('Pack não encontrado');

    if (semaforoIds && semaforoIds.length < 2) {
      throw new BadRequestException(
        'Um pack precisa de pelo menos 2 semáforos.',
      );
    }

    return this.prisma.pack.update({
      where: { id },
      data: {
        ...(semaforoIds
          ? {
              semaforos: {
                set: semaforoIds.map((id) => ({ id })),
              },
            }
          : {}),
      },
      include: { semaforos: true },
    });
  }

  async deletePack(id: number) {
    const pack = await this.prisma.pack.findUnique({ where: { id } });
    if (!pack) throw new NotFoundException('Pack não encontrado');

    return this.prisma.pack.delete({ where: { id } });
  }

  async createSubPack(semaforoIds: number[], packId: number) {
    if (semaforoIds.length < 2) {
      throw new BadRequestException(
        'Um pack precisa de pelo menos 2 semáforos.',
      );
    }

    const pack = await this.prisma.subPack.create({
      data: {
        packId,
        semaforos: {
          connect: semaforoIds.map((id) => ({ id })),
        },
      },
      include: {
        semaforos: true,
      },
    });

    return pack;
  }

  async getAllSubPacks() {
    return this.prisma.subPack.findMany({
      include: {
        semaforos: true,
      },
    });
  }

  async getSubPack(id: number) {
    const pack = await this.prisma.subPack.findUnique({
      where: { id },
      include: { semaforos: true },
    });
    if (!pack) {
      throw new NotFoundException('Pack não encontrado');
    }
    return pack;
  }

  async updateSubPack(id: number, semaforoIds?: number[]) {
    const pack = await this.prisma.subPack.findUnique({ where: { id } });
    if (!pack) throw new NotFoundException('Pack não encontrado');

    // Se passar semáforos, precisa ter pelo menos 2
    if (semaforoIds && semaforoIds.length < 2) {
      throw new BadRequestException(
        'Um pack precisa de pelo menos 2 semáforos.',
      );
    }

    return this.prisma.pack.update({
      where: { id },
      data: {
        ...(semaforoIds
          ? {
              semaforos: {
                set: semaforoIds.map((id) => ({ id })),
              },
            }
          : {}),
      },
      include: { semaforos: true },
    });
  }

  async deleteSubPack(id: number) {
    const pack = await this.prisma.subPack.findUnique({ where: { id } });
    if (!pack) throw new NotFoundException('Sub Pack não encontrado');

    return this.prisma.subPack.delete({ where: { id } });
  }
}
