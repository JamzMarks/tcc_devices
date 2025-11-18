import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import neo4j, { Driver, Session } from 'neo4j-driver';
import * as fs from 'fs';
import * as xml2js from 'xml2js';
import { WayName } from '@Types/graph/ways';
import { SemaforoDto } from '@dtos/semaforos/semaforo.dto';
import { DeviceDto, DeviceGraphDto } from '@dtos/device.dto';
import { PackDto } from '@dtos/pack/pack.dto';

@Injectable()
export class GraphService implements OnModuleInit, OnModuleDestroy {
  private driver: Driver;
  private uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  private user = process.env.NEO4J_USERNAME || 'neo4j';
  private pass = process.env.NEO4J_PASSWORD || 'neo4j';

  onModuleInit() {
    this.driver = neo4j.driver(
      this.uri,
      neo4j.auth.basic(this.user, this.pass),
    );
  }

  async onModuleDestroy() {
    if (this.driver) await this.driver.close();
  }

  private session(write = false): Session {
    return this.driver.session({
      defaultAccessMode: write ? neo4j.session.WRITE : neo4j.session.READ,
    });
  }

  async exportGraphForBuild(): Promise<{
    nodes: any[];
    relationships: any[];
    devices: any[];
  }> {
    const session = this.session();
    try {
      // Colete nós
      const waysResult = await session.run(`
        MATCH p=(w:OSMWay)-[:HAS_NODE]->(n:OSMNode)
        RETURN p
      `);

      const devicesResult = await session.run(`
        MATCH (n:Semaforo), (m:Device) 
        RETURN n, m
      `);

      const devices: any[] = [];
      for (const rec of devicesResult.records) {
        const semaforo = rec.get('n');
        const device = rec.get('m');

        // Adiciona Semaforo
        if (semaforo) {
          devices.push({
            id: semaforo.elementId,
            type: 'Semaforo',
            labels: semaforo.labels,
            properties: semaforo.properties,
          });
        }

        // Adiciona Device
        if (device) {
          devices.push({
            id: device.elementId,
            type: 'Device',
            labels: device.labels,
            properties: device.properties,
          });
        }
      }

      const waysMap = new Map<string, { properties: any; nodes: any[] }>();

      for (const rec of waysResult.records) {
        const path = rec.get('p');
        // Cada path tem segmentos [{ start: way, relationship, end: node }]
        for (const segment of path.segments) {
          const wayNode = segment.start;
          // const wayId = wayNode.identity.toString();
          const wayId = wayNode.elementId;
          const osmNode = segment.end;
          const { id, ...props } = wayNode.properties;
          // const nodeId = osmNode.identity.toString();
          const nodeId = osmNode.elementId;

          // Garante que a way exista no Map
          if (!waysMap.has(wayId)) {
            waysMap.set(wayId, {
              properties: {
                label: wayNode.labels,
                wayId: wayId,
                ...props,
              },
              nodes: [],
            });
          }

          // Adiciona o nó físico
          const wayData = waysMap.get(wayId)!;
          wayData.nodes.push({
            id: nodeId,
            lat: osmNode.properties.lat,
            lon: osmNode.properties.lon,
            tags: osmNode.properties.tags || {},
          });
        }
      }
      // Colete relações
      const relsResult = await session.run(
        `MATCH ()-[r]->() RETURN DISTINCT r`,
      );
      const relationships: any[] = [];
      for (const rec of relsResult.records) {
        const rel = rec.get('r');
        const { index, ...props } = rel.properties;
        relationships.push({
          id: rel.elementId, // stable ID
          type: rel.type,
          startNodeId: rel.startNodeElementId, // elementId do nó de início
          endNodeId: rel.endNodeElementId, // elementId do nó de fim
          properties: props,
        });
      }

      return {
        nodes: Array.from(waysMap.values()),
        relationships,
        devices,
      };
    } finally {
      await session.close();
    }
  }

  async clearWayNodes(wayId: string): Promise<void> {
    const session = this.session(true);
    try {
      console.log('🧹 Limpando nós exclusivos da way...');

      await session.run(
        `
        MATCH (w:OSMWay)-[:HAS_NODE]->(n:OSMNode)
        WHERE elementId(w) = $wayId
        DETACH DELETE w, n
        RETURN count(w) AS deletedWays, count(n) AS deletedNodes;

      `,
        { wayId },
      );

      console.log('✅ Nós exclusivos removidos com sucesso.');
    } catch (error) {
      console.error('❌ Erro ao limpar nós:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async importFromJson(filePath: string) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const { elements } = JSON.parse(raw);
    const nodes: any[] = [];
    const ways: any[] = [];
    elements.forEach((el: any) => {
      if (el.type === 'node') {
        nodes.push({
          id: parseInt(el.id),
          lat: el.lat,
          lon: el.lon,
          tags: el.tags || {},
        });
      } else if (el.type === 'way') {
        ways.push({
          id: parseInt(el.id),
          nodes: el.nodes,
          tags: el.tags || {},
        });
      }
    });

    const session = this.driver.session();
    const tx = session.beginTransaction();

    try {
      //  inserir nodes
      await tx.run(
        `
        UNWIND $nodes AS n
        MERGE (node:OSMNode {id: toInteger(n.id)})
        SET node.lat = coalesce(node.lat, n.lat),
            node.lon = coalesce(node.lon, n.lon),
            node += n.tags
        `,
        { nodes },
      );

      // inserir ways
      await tx.run(
        `
        UNWIND $ways AS w
        MERGE (way:OSMWay {id: toInteger(w.id)})
        SET way += w.tags
        `,
        { ways },
      );

      // relacionar cada way
      await tx.run(
        `
        UNWIND $ways AS w
        UNWIND range(0, size(w.nodes)-1) AS i
        MATCH (way:OSMWay {id: toInteger(w.id)})
        MATCH (node:OSMNode {id: toInteger(w.nodes[i])})
        MERGE (way)-[:HAS_NODE {index: i}]->(node)
        `,
        { ways },
      );

      // criar edges
      await tx.run(
        `
        UNWIND $ways AS w
        UNWIND range(0, size(w.nodes)-2) AS i
        MATCH (a:OSMNode {id: toInteger(w.nodes[i])}),
              (b:OSMNode {id: toInteger(w.nodes[i+1])})
        MERGE (a)-[:CONNECTED_TO {wayId: toInteger(w.id)}]->(b)
        `,
        { ways },
      );
      await tx.commit();
      return {
        success: true,
        nodes: nodes.length,
        ways: ways.length,
      };
    } catch (err) {
      await tx.rollback();
      console.log(err);
      throw new Error(err);
    } finally {
      await session.close();
    }
  }

  async getWays() {
    const session = this.session();
    try {
      const nodesResult = await session.run(`MATCH (n:${WayName}) RETURN n `);
      const nodesMap = new Map<string, any>();

      for (const rec of nodesResult.records) {
        const node = rec.get('n');
        const { name, ...rest } = node.properties;
        try {
          const id = node.elementId;
          nodesMap.set(id, {
            id: id,
            name: name,
            labels: node.tags,
            elementId: node.elementId,
            properties: rest,
          });
        } catch (error) {
          console.log(node);
        }
      }
      return {
        nodes: Array.from(nodesMap.values()),
      };
    } finally {
      await session.close();
    }
  }

  async getCommonNodesBetweenWays(name1: string, name2: string) {
    const session = this.session();
    try {
      const query = `
      MATCH (w1:OSMWay {name: $name1})-[:HAS_NODE]->(n:OSMNode)<-[:HAS_NODE]-(w2:OSMWay {name: $name2})
      RETURN DISTINCT n
    `;

      const result = await session.run(query, { name1, name2 });
      const nodes: any[] = [];

      for (const rec of result.records) {
        const node = rec.get('n');
        nodes.push({
          id: node.elementId,
          labels: node.labels,
          properties: node.properties,
        });
      }

      return nodes;
    } finally {
      await session.close();
    }
  }

  async getNodeById(nodeId: string) {
    const session = this.session();
    try {
      const query = `
      MATCH (n:OSMNode) WHERE elementId(n) = $nodeId
      RETURN n
    `;
      const result = await session.run(query, { nodeId });
      if (result.records.length === 0) {
        return null;
      }
      const node = result.records[0].get('n');
      return node;
    } finally {
      await session.close();
    }
  }

  
  async createDevice(
    nodeId1: string,
    nodeId2: string,
    wayId: string,
    device: DeviceGraphDto,
  ) {
    const session = this.session(true);
    try {
      const deviceNode = await session.writeTransaction(async (tx) => {
        const checkNodes = await tx.run(
          `
          MATCH (n1:OSMNode)-[r:CONNECTED_TO]-(n2:OSMNode)
          WHERE elementId(n1) = $nodeId1
            AND elementId(n2) = $nodeId2
          RETURN COUNT(r) > 0 AS exists
        `,
          { nodeId1, nodeId2 },
        );

        const exists = checkNodes.records[0].get('exists');
        if (!exists) {
          throw new Error('Os nós não estão conectados via CONNECT_TO');
        }

        const checkDevice = await tx.run(
          `MATCH (n:Device {deviceId: $deviceId}) RETURN n`,
          { deviceId: device.deviceId },
        );

        if (checkDevice.records.length > 0) {
          throw new Error('DeviceId already in use');
        }

        const result = await tx.run(
          `
        MATCH (n1:OSMNode), (n2:OSMNode), (w:OSMWay)
        WHERE elementId(n1) = $nodeId1
          AND elementId(n2) = $nodeId2
          AND elementId(w) = $wayId
        MERGE (d:Device {id: randomUUID()})
        SET d.type = $type,
            d.deviceId = $deviceId,
            d.macAddress = $macAddress,
            d.ip = $ip,
            d.isActive = $isActive
        MERGE (d)-[:DEVICE_BETWEEN]->(n1)
        MERGE (d)-[:DEVICE_BETWEEN]->(n2)
        MERGE (d)-[:FEED_DATA_ON]->(w)
        RETURN d, n1, n2, w

        `,
          {
            nodeId1,
            nodeId2,
            wayId,
            type: device.type,
            deviceId: device.deviceId,
            macAddress: device.macAddress || null,
            ip: device.ip || null,
            isActive: device.isActive ?? false,
            // metadata: device.metadata || {},
          },
        );
        await tx.commit();
        const deviceRes = result.records[0]?.get('d');
        if (!deviceRes) {
          throw new Error('Erro ao criar o Device');
        }

        return deviceRes.properties;
      });

      return deviceNode;
    } catch (error) {
      console.error('Erro ao criar Device:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async createPackWithValidation(packJson: PackDto) {
    const session = this.driver.session();
    const tx = session.beginTransaction();

    try {
      // Coletar todos os semáforos do pacote e subpacotes
      const allSemIds = [
        ...(packJson.semaforos || []),
        ...(packJson.subPacks || []).flatMap((sp) => sp.semaforos || []),
      ];

      // 1. Verifica conflitos
      const conflictCheck = await tx.run(
        `
      MATCH (s:Semaforo)
      WHERE s.id IN $semIds AND (s)-[:BELONGS_TO_PACK]->(:Pack)
      RETURN s.id AS conflictId
      `,
        { semIds: allSemIds },
      );

      if (conflictCheck.records.length > 0) {
        const ids = conflictCheck.records.map((r) => r.get('conflictId'));
        throw new Error(
          `Semáforos já pertencem a outro pack: ${ids.join(', ')}`,
        );
      }

      // 2. Criar o pack principal
      await tx.run(
        `
      CREATE (p:Pack {
        id: $id,
        createdAt: datetime(),
        type: "MASTER"
      })
      `,
        { id: packJson.id },
      );

      // 3. Relacionar semáforos diretos
      if (packJson.semaforos?.length) {
        await tx.run(
          `
        MATCH (s:Semaforo)
        WHERE s.id IN $semIds
        MATCH (p:Pack {id: $packId})
        CREATE (s)-[:BELONGS_TO_PACK]->(p)
        `,
          {
            semIds: packJson.semaforos,
            packId: packJson.id,
          },
        );
      }

      // 4. Criar subpacks e relacionar seus semáforos
      for (const sub of packJson.subPacks || []) {
        await tx.run(
          `
        MATCH (p:Pack {id: $parentPack})
        CREATE (sp:Pack {
          id: $subId,
          createdAt: datetime(),
          type: "SUB"
        })
        CREATE (sp)-[:SUBPACK_OF]->(p)
        `,
          {
            parentPack: packJson.id,
            subId: sub.id,
          },
        );

        if (sub.semaforos?.length) {
          await tx.run(
            `
          MATCH (s:Semaforo)
          WHERE s.id IN $semIds
          MATCH (sp:Pack {id: $subId})
          CREATE (s)-[:BELONGS_TO_PACK]->(sp)
          `,
            {
              semIds: sub.semaforos,
              subId: sub.id,
            },
          );
        }
      }

      await tx.commit();
    } catch (err) {
      await tx.rollback();
      throw err;
    } finally {
      await session.close();
    }
  }
}
