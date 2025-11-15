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
import { UpdateSemaforoDto } from '@dtos/semaforos/update-semafoto.dto';
import { CreateSemaforoDto } from '@dtos/semaforos/create-semafoto.dto';
import { mapNode } from '@utils/formatters/neo4j-formatters';
import { SemaforoInfoDto } from '@dtos/semaforos/semaforo-info.dto';
import { Neo4jService } from './neo4j.service';
import neo4j from 'neo4j-driver';

@Injectable()
export class SemaforoService {
  private registry: Registry;

  constructor(
    private prisma: PrismaService,
    private readonly neo4jService: Neo4jService,
  ) {
    const connectionString = process.env.AZURE_IOTHUB_CONNECTION_STRING!;
    this.registry = Registry.fromConnectionString(connectionString);
  }

  async createSemaforo(dto: CreateSemaforoDto) {
    // 1 — Verificar se já existe semáforo com esse MAC
    const checkSession = this.neo4jService.getReadSession();
    const exists = await checkSession.run(
      `
      MATCH (s:Semaforo {macAddress: $macAddress})
      RETURN s
    `,
      { macAddress: dto.macAddress },
    );
    await checkSession.close();

    if (exists.records.length > 0) {
      throw new BadRequestException('Semáforo com esse MAC já existe');
    }

    // 2 — Criar device no Azure IoT Hub
    let azureDevice;
    try {
      azureDevice = await this.registry.create({ deviceId: dto.deviceId });
    } catch (err) {
      throw new BadRequestException(
        'Erro ao criar device no Azure: ' + err.message,
      );
    }

    const deviceKey =
      azureDevice.responseBody.authentication.symmetricKey.primaryKey;

    // 3 — Criar nó no Neo4j
    const session = this.neo4jService.getWriteSession();

    try {
      const result = await session.run(
        `
      CREATE (s:Semaforo {
        macAddress: $macAddress,
        deviceId: $deviceId,
        deviceKey: $deviceKey,
        isActive: false,
        createdAt: datetime(),
        updatedAt: datetime()
      })
      RETURN elementId(s) AS id, s;
      `,
        {
          macAddress: dto.macAddress,
          deviceId: dto.deviceId,
          deviceKey,
        },
      );

      return {
        id: result.records[0].get('id'),
        ...result.records[0].get('s').properties,
      };
    } catch (err) {
      // 4 — Rollback no Azure
      await this.registry.delete(dto.deviceId);
      throw new BadRequestException(
        'Erro ao salvar no Neo4j. Azure IoT Hub revertido: ' + err.message,
      );
    } finally {
      await session.close();
    }
  }

  async getAllSemaforos(filters: SemaforoFilters) {
    const {
      query = null,
      subPack = null,
      isActive = null,
      pack = null,
      page = 1,
      limit = 20,
    } = filters;

    const session = this.neo4jService.getReadSession();
    const skipNeo = neo4j.int((page - 1) * limit);
    const limitNeo = neo4j.int(limit);
    try {
      // BUSCAR COM PAGINAÇÃO
      const result = await session.run(
        `
      MATCH (s:Semaforo)
      WHERE 
        ($query IS NULL OR 
          toLower(s.macAddress) CONTAINS toLower($query) OR
          toLower(s.deviceId) CONTAINS toLower($query))
        AND ($isActive IS NULL OR s.isActive = $isActive)
      
        // filtro por pack
        AND ($pack IS NULL OR (s)-[:BELONGS_TO_PACK]->(:Pack {id: $pack}))
      
        // filtro por subpack
        AND ($subPack IS NULL OR (s)-[:BELONGS_TO_SUBPACK]->(:SubPack {id: $subPack}))
      
      RETURN s
      SKIP $skipNeo
      LIMIT $limitNeo
      `,
        { query, isActive, pack, subPack, skipNeo, limitNeo },
      );
      const semaforos: SemaforoDto[] = result.records.map((r) => {
        const node = r.get('s');
        return mapNode(node);
      });

      // COUNT TOTAL
      const countResult = await session.run(
        `
      MATCH (s:Semaforo)
      WHERE 
        ($query IS NULL OR 
          toLower(s.macAddress) CONTAINS toLower($query) OR
          toLower(s.deviceId) CONTAINS toLower($query))
        AND ($isActive IS NULL OR s.isActive = $isActive)
        AND ($pack IS NULL OR (s)-[:BELONGS_TO_PACK]->(:Pack {id: $pack}))
        AND ($subPack IS NULL OR (s)-[:BELONGS_TO_SUBPACK]->(:SubPack {id: $subPack}))
      
      RETURN count(s) AS total
      `,
        { query, isActive, pack, subPack },
      );

      const total = countResult.records[0].get('total').toNumber();

      return {
        data: semaforos,
        total,
        page,
        limit,
      };
    } finally {
      await session.close();
    }
  }

  async findManyByIds(ids: string[]) {
    const session = this.neo4jService.getReadSession();

    try {
      const result = await session.run(
        `
        MATCH (s:Semaforo)
        WHERE elementId(s) IN $ids
        RETURN s
        `,
        { ids },
      );

      const semaforos = result.records.map((r) => r.get('s').properties);

      if (semaforos.length !== ids.length) {
        throw new NotFoundException(
          'Um ou mais semáforos informados não existem.',
        );
      }

      return semaforos;
    } finally {
      await session.close();
    }
  }

  async getSemaforo(id: string): Promise<SemaforoInfoDto> {
    const session = this.neo4jService.getReadSession();
    const result = await session.run(
      `
      MATCH (s:Semaforo)
      WHERE elementId(s) = $id

      OPTIONAL MATCH (s)-[:CONTROLS_TRAFFIC_ON]->(w:OSMWay)
      OPTIONAL MATCH (n:OSMNode)-[:HAS_SEMAFORO]->(s)

      RETURN s, collect(DISTINCT w) AS ways, collect(DISTINCT n) AS nodes
      `,
      { id },
    );

    if (result.records.length === 0) {
      throw new NotFoundException('Semáforo não encontrado');
    }

    await session.close();
    const record = result.records[0];
    const semaforo = mapNode(record.get('s'));

    return {
      semaforo,
      // ways: record.get("ways").map(w => w.properties),
      // nodes: record.get("nodes").map(n => n.properties),
    };
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

  async getByMacAdress(macAddress: string): Promise<SemaforoDto> {
    const session = this.neo4jService.getReadSession();
    const result = await session.run(
      `
      MATCH (s:Semaforo)
      WHERE s.macAddress = $macAddress
      RETURN s
      `,
      { macAddress },
    );

    if (result.records.length === 0) {
      throw new NotFoundException('Semáforo não encontrado');
    }

    await session.close();
    const record = result.records[0];
    const semaforo = mapNode(record.get('s'));
    return semaforo;
  }

  
}
