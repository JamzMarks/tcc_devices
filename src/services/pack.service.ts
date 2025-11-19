import { SemaforoService } from 'src/services/semaforo.service';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PackDto } from '@dtos/pack/pack.dto';
import { Neo4jService } from './neo4j.service';

@Injectable()
export class PackService {
  constructor(
    private readonly semaforoService: SemaforoService,
    private readonly neo4j: Neo4jService,
  ) {}

  async createPack(data: PackDto) {
    const { name, semaforos, subPacks, configs } = data;

    if (
      (!semaforos || semaforos.length === 0) &&
      (!subPacks || subPacks.length === 0)
    ) {
      throw new BadRequestException(
        'É necessário informar pelo menos 1 semáforo ou 1 SubPack.',
      );
    }

    const session = this.neo4j.getWriteSession();
    const tx = session.beginTransaction();

    try {
      // Criar Pack
      const packResult = await tx.run(
        `
        CREATE (p:Pack { name: $name, cicle: $cicle })
        RETURN elementId(p) AS packElementId
        `,
        { name, cicle: configs.cicle },
      );

      const packId = packResult.records[0].get('packElementId');

      // Conectar semáforos ao Pack
      if (semaforos.length > 0) {
        const existing = await this.semaforoService.findManyByIds(semaforos);
        if (existing.length !== semaforos.length) {
          throw new BadRequestException(
            'Um ou mais semáforos informados não existem.',
          );
        }
        await tx.run(
          `
          MATCH (p:Pack)
          WHERE elementId(p) = $packId
          UNWIND $semaforosIds AS sid
          MATCH (s:Semaforo)
          WHERE elementId(s) = sid
          MERGE (p)-[:HAS_SEMAFORO]->(s)
          `,
          { packId, semaforosIds: semaforos },
        );
      }

      // Criar SubPacks
      for (const sub of subPacks) {
        if (sub.semaforos.length < 2) {
          throw new BadRequestException(
            'Cada SubPack precisa de pelo menos 2 semáforos.',
          );
        }

        const subIds = sub.semaforos;

        // Validar existência
        const existSub = await this.semaforoService.findManyByIds(subIds);
        if (existSub.length !== sub.semaforos.length) {
          throw new BadRequestException(
            'Um ou mais semáforos do SubPack não existem.',
          );
        }

        // Criar SubPack e conectar ao Pack
        const subPackResult = await tx.run(
          `
          MATCH (p:Pack)
          WHERE elementId(p) = $packId
          CREATE (sp:SubPack)
          MERGE (p)-[:HAS_SUBPACK]->(sp)
          RETURN elementId(sp) AS subpackElementId
          `,
          { packId },
        );

        const subpackId = subPackResult.records[0].get('subpackElementId');

        // Conectar semáforos ao SubPack
        await tx.run(
          `
          MATCH (sp:SubPack)
          WHERE elementId(sp) = $subpackId
          UNWIND $subIds AS sid
          MATCH (s:Semaforo)
          WHERE elementId(s) = sid
          MERGE (sp)-[:HAS_SEMAFORO]->(s)
          `,
          { subpackId, subIds },
        );
      }

      // Commit da transação
      await tx.commit();

      // Retornar Pack completo
      const packFull = await session.run(
        `
        MATCH (p:Pack)
          WHERE elementId(p) = $packId
          OPTIONAL MATCH (p)-[:HAS_SEMAFORO]->(s:Semaforo)
          WITH p, collect(DISTINCT elementId(s)) AS semaforos
          OPTIONAL MATCH (p)-[:HAS_SUBPACK]->(sp:SubPack)
          OPTIONAL MATCH (sp)-[:HAS_SEMAFORO]->(ss:Semaforo)
          WITH p, semaforos, sp, collect(DISTINCT elementId(ss)) AS subSemaforos
          WITH p, semaforos, collect(DISTINCT { subpackId: elementId(sp), semaforos: subSemaforos }) AS subpacks
          RETURN 
            elementId(p) AS packId, 
            p.name AS name, 
            p.cicle AS cicle,
            semaforos,
            subpacks
        `,
        { packId },
      );

      return packFull.records;
    } catch (err) {
      await tx.rollback();
      throw err;
    } finally {
      await session.close();
    }
  }

  async getAllPacks() {
    const session = this.neo4j.getReadSession();
    try {
      const result = await session.run(
        `
        MATCH (p:Pack)
        RETURN elementId(p) AS id, p.name AS name, p.cicle AS cicle
        `,
      );

      return result.records.map((r) => ({
        id: r.get('id'),
        name: r.get('name'),
        cicle: r.get('cicle'),
      }));
    } finally {
      await session.close();
    }
  }
  async getPack(packId: string) {
    const session = this.neo4j.getReadSession();
    try {
      const result = await session.run(
        `
      MATCH (p:Pack)
        WHERE elementId(p) = $packId
        OPTIONAL MATCH (p)-[:HAS_SEMAFORO]->(s:Semaforo)
        WITH p, collect(DISTINCT elementId(s)) AS semaforos
        OPTIONAL MATCH (p)-[:HAS_SUBPACK]->(sp:SubPack)
        OPTIONAL MATCH (sp)-[:HAS_SEMAFORO]->(ss:Semaforo)
        WITH p, semaforos, sp, collect(DISTINCT elementId(ss)) AS subSemaforos
        WITH p, semaforos, collect(DISTINCT { subpackId: elementId(sp), semaforos: subSemaforos }) AS subpacks
        RETURN 
          elementId(p) AS packId, 
          p.name AS name, 
          p.cicle AS cicle,
          semaforos,
          subpacks

      `,
        { packId },
      );

      if (result.records.length === 0) {
        throw new NotFoundException('Pack não encontrado');
      }

      return result.records[0].toObject();
    } finally {
      await session.close();
    }
  }

  // async updatePack(id: number, semaforoIds?: number[]) {
  //   const pack = await this.prisma.pack.findUnique({ where: { id } });
  //   if (!pack) throw new NotFoundException('Pack não encontrado');

  //   if (semaforoIds && semaforoIds.length < 2) {
  //     throw new BadRequestException(
  //       'Um pack precisa de pelo menos 2 semáforos.',
  //     );
  //   }

  //   return this.prisma.pack.update({
  //     where: { id },
  //     data: {
  //       ...(semaforoIds
  //         ? {
  //             semaforos: {
  //               set: semaforoIds.map((id) => ({ id })),
  //             },
  //           }
  //         : {}),
  //     },
  //     include: { semaforos: true },
  //   });
  // }

  async deletePack(packId: string) {
    const session = this.neo4j.getWriteSession();
    try {
      await session.run(
        `
      MATCH (p:Pack)
      WHERE elementId(p) = $packId
      OPTIONAL MATCH (p)-[r1:HAS_SEMAFORO]->()
      DELETE r1
      WITH p
      OPTIONAL MATCH (p)-[:HAS_SUBPACK]->(sp:SubPack)
      DETACH DELETE sp
      WITH p
      DELETE p
      `,
        { packId },
      );
      return { message: 'Pack deletado com sucesso' };
    } finally {
      await session.close();
    }
  }
}
