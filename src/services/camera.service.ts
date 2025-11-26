import { Session, Transaction } from 'neo4j-driver';
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Neo4jService } from './neo4j.service';
import { CameraDto } from '@dtos/camera/camera.dto';


@Injectable()
export class CameraService {
  constructor(private readonly neo4jService: Neo4jService,) {
  }

  async createCamera(dto: {
    deviceId: string;
    ip: string;
    nodeA: string;
    nodeB: string;
  }) {
    const session = this.neo4jService.getWriteSession();
    const { deviceId, ip, nodeA, nodeB } = dto;

    try {
      const result = await session.writeTransaction(async (tx) => {

        // Verificar se device já existe
        const exists = await tx.run(
          `MATCH (d:Device {deviceId: $deviceId}) RETURN d`,
          { deviceId }
        );

        if (exists.records.length > 0) {
          throw new BadRequestException('DeviceId already exists');
        }

        // Criar o device
        const created = await tx.run(
          `
          CREATE (d:Device {
            deviceId: $deviceId,
            ip: $ip,
            isActive: false,
            createdAt: datetime(),
            updatedAt: datetime()
          })
          RETURN d, elementId(d) AS id
          `,
          { deviceId, ip }
        );  

        await this.linkCamera(deviceId, nodeA, nodeB, tx);  

        return {
          device: created.records[0].get('d').properties,
          id: created.records[0].get('id'),
        };
      });
      return result;

    } catch (error) {
      console.error('Erro ao criar camera:', error);
      throw error;
    } finally {
      await session.close();
    }
  }


  async getAllCameras() {
    const session = this.neo4jService.getReadSession();
    try {
      const result = await session.run(`MATCH (c:Device) RETURN c`);

      return result.records.map((r) => {
        const props = r.get('c').properties;

        // Converte updatedAt se for DateTime
        if (props.updatedAt && typeof props.updatedAt.toString === 'function') {
          props.updatedAt = props.updatedAt.toString(); 
        }
        if (props.createdAt && typeof props.createdAt.toString === 'function') {
          props.createdAt = props.createdAt.toString(); 
        }

        return props;
      });
    } catch (error) {
      throw error;
    } finally {
      await session.close();
    }
  }

  async getCamera(id: string): Promise<CameraDto> {
    const session = this.neo4jService.getReadSession();

    try {
      const result = await session.run(
        `
        MATCH (c:Device)
        WHERE elementId(c) = $id
        RETURN c
      `,
        { id }
      );

      if (result.records.length === 0) {
        throw new NotFoundException('Device não encontrada');
      }

      return result.records[0].get('c').properties;

    } catch (err) {
      throw new BadRequestException(
        'Erro ao buscar dispositivo no Neo4j: ' + err.message,
      );
    } finally {
      await session.close();
    }
  }

  // async updateCamera(id: number, macAddress?: string, deviceId?: string, isActive?: boolean) {
  //   const camera = await this.prisma.camera.findUnique({ where: { id } });
  //   if (!camera) throw new NotFoundException('Camera não encontrada');

  //   // Se atualizar MAC, verificar duplicidade
  //   if (macAddress && macAddress !== camera.macAddress) {
  //     const exists = await this.prisma.camera.findFirst({ where: { macAddress } });
  //     if (exists) throw new BadRequestException('MAC já está em uso');
  //   }

  //   return this.prisma.camera.update({
  //     where: { id },
  //     data: {
  //       macAddress,
  //       deviceId,
  //       isActive,
  //     },
  //   });
  // }
  
  async deleteCamera(id: string): Promise<void> {
    await this.getCamera(id);

    const session = this.neo4jService.getWriteSession();
    try {
      await session.run(`
        MATCH (c:Device)
        WHERE elementId(c) = $id
        DETACH DELETE c
      `,
        {
          id
        },
      );

    } catch (err) {
      throw new BadRequestException(
        'Erro ao deletar dispositivo no Neo4j: ' + err.message,
      );
    } finally {
      await session.close();
    }
  }

  async linkCamera(deviceId: string, nodeA: string, nodeB: string): Promise<void>;
  async linkCamera(deviceId: string, nodeA: string, nodeB: string, transaction: Transaction);
  async linkCamera(deviceId: string, nodeA: string, nodeB: string, transaction?: Transaction) {
    if (transaction) {
      return this.LinkCameraFunction(deviceId, nodeA, nodeB, transaction);
    }
    const session = this.neo4jService.getWriteSession();
    try {
      const result = await session.writeTransaction(async (tx) => {
        return this.LinkCameraFunction(deviceId, nodeA, nodeB, tx);
      });

      return result;
    } catch (error) {
      console.error("Erro ao vincular camera:", error);
      throw error;
    } finally {
      await session.close();
    }
  }

  private async LinkCameraFunction(deviceId: string, nodeA: string, nodeB: string, transaction: Transaction): Promise<void>{
    try {
        const nodes = await transaction.run(
          `
          MATCH (a:OSMNode) WHERE elementId(a) = $nodeA
          MATCH (b:OSMNode) WHERE elementId(b) = $nodeB
          MATCH (w:OSMWay)-[:HAS_NODE]->(a)
          MATCH (w)-[:HAS_NODE]->(b)
          RETURN a, b, w
          `,
          { nodeA, nodeB }
        );

        if (nodes.records.length === 0) {
          throw new Error('OSMNodes inválidos ou não pertencem ao mesmo OSMWay');
        }

        const wayElementId = nodes.records[0].get('w').elementId;

        const device = await transaction.run(
          `
          MATCH (d:Device {deviceId: $deviceId})
          RETURN d
          `,
          { deviceId }
        );

        if (device.records.length === 0) {
          throw new Error('Device não encontrado');
        }

        await transaction.run(
          `
          MATCH (d:Device {deviceId: $deviceId})
          MATCH (a:OSMNode) WHERE elementId(a) = $nodeA
          MATCH (b:OSMNode) WHERE elementId(b) = $nodeB
          MATCH (w:OSMWay) WHERE elementId(w) = $wayElementId

          MERGE (d)-[:BETWEEN_ON]->(a)
          MERGE (d)-[:BETWEEN_ON]->(b)
          MERGE (d)-[:FEED_DATA_ON]->(w)
          `,
          { deviceId, nodeA, nodeB, wayElementId }
        );
    } catch (error) {
      console.error('Erro ao vincular camera:', error);
      throw error;
    }
  }

  async unlinkCamera(deviceId: string) {
    const session = this.neo4jService.getWriteSession();

    try {
      const result = await session.writeTransaction(async (tx) => {
        // Verifica se o semáforo existe
        const semaforoResult = await tx.run(
          `MATCH (s:Semaforo {deviceId: $deviceId}) RETURN s`,
          { deviceId },
        );

        if (semaforoResult.records.length === 0) {
          throw new Error('Semáforo não encontrado');
        }

        await tx.run(
          `
        MATCH (s:Semaforo {deviceId: $deviceId})-[r:LOCATED_AT]->(n:OSMNode)
        DELETE r
        `,
          { deviceId },
        );

        // Remove a relação CONTROLS_TRAFFIC_ON se existir
        await tx.run(
          `
        MATCH (s:Semaforo {deviceId: $deviceId})-[r:CONTROLS_TRAFFIC_ON]->(w:OSMWay)
        DELETE r
        `,
          { deviceId },
        );

        return semaforoResult.records[0].get('s');
      });

      return result;
    } catch (error) {
      console.error('Erro ao desvincular device:', error);
      throw error;
    } finally {
      await session.close();
    }
  }
}
