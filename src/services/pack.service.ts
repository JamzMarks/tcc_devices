import { SubPack } from './../../generated/prisma/index.d';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class PackService {
  constructor(private prisma: PrismaService) {}

  /**
   * Cria um Pack com semáforos associados
   * @param node nome do pack
   * @param semaforoIds array de IDs de semáforos
   */
  async createPack(node: string, semaforoIds: number[], subPacks: number[]) {
    if (semaforoIds.length < 2) {
      throw new BadRequestException(
        'Um pack precisa de pelo menos 2 semáforos.',
      );
    }

    const pack = await this.prisma.pack.create({
      data: {
        node,
        semaforos: {
          connect: semaforoIds.map((id) => ({ id })),
        },
        subPacks: {
          connect: subPacks.map((id) => ({ id })),
        },
      },
      include: {
        semaforos: true,
        subPacks: true,
      },
    });

    return pack;
  }

  async getAllPacks() {
    return this.prisma.pack.findMany({
      include: {
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

  async updatePack(id: number, node?: string, semaforoIds?: number[]) {
    const pack = await this.prisma.pack.findUnique({ where: { id } });
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
        node,
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

  async updateSubPack(id: number, node?: string, semaforoIds?: number[]) {
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
        node,
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
