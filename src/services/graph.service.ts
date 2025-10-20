import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import neo4j, { Driver, Session } from 'neo4j-driver';
import * as fs from 'fs';
import * as xml2js from 'xml2js';
import { WayName } from '@Types/graph/ways';
import { SemaforoDto } from '@dtos/semaforos/semaforo.dto';
import { DeviceDto, DeviceGraphDto } from '@dtos/device.dto';

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

  async exportFullGraph(): Promise<{ nodes: any[]; relationships: any[] }> {
    const session = this.session();
    try {
      // Colete nós
      const nodesResult = await session.run(`MATCH (n) RETURN DISTINCT n`);
      const nodesMap = new Map<string, any>();
      for (const rec of nodesResult.records) {
        const node = rec.get('n');
        // const id = node.identity.toString();
        const id = node.elementId;
        nodesMap.set(id, {
          id,
          labels: node.tags,
          properties: node.properties,
          lat: node.lat,
          lon: node.lon,
        });
      }

      // Colete relações
      const relsResult = await session.run(
        `MATCH ()-[r]->() RETURN DISTINCT r`,
      );
      const relationships: any[] = [];
      for (const rec of relsResult.records) {
        const r = rec.get('r');
        relationships.push({
          // id: r.identity.toString(),
          id: r.elementId,
          type: r.type,
          startNodeId: r.start.toString(),
          endNodeId: r.end.toString(),
          properties: r.properties,
        });
      }

      return {
        nodes: Array.from(nodesMap.values()),
        relationships,
      };
    } finally {
      await session.close();
    }
  }

  async exportGraphForBuild(): Promise<{ nodes: any[]; relationships: any[] }> {
    const session = this.session();
    try {
      // Colete nós
      const waysResult = await session.run(`
        MATCH p=(w:OSMWay)-[:HAS_NODE]->(n:OSMNode)
        RETURN p
      `);

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

  async clearGraphData(): Promise<void> {
    const session = this.session(true);
    try {
      console.log('🧹 Limpando o grafo...');

      // 1️⃣ Remove apenas OSMNodes de ways com service=parking_aisle
      // que não estão conectados a nenhuma outra way
      await session.run(`
      MATCH (w:OSMWay {service: "parking_aisle"})-[:HAS_NODE]->(n:OSMNode)
      WHERE NOT EXISTS {
        MATCH (other:OSMWay)-[:HAS_NODE]->(n)
        WHERE elementId(other) <> elementId(w)
      }
      DETACH DELETE n
    `);

      // 2️⃣ Remove as ways "alley" e seus nodes diretamente
      await session.run(`
      MATCH (w:OSMWay {service: "parking_aisle"})-[:HAS_NODE]->(n:OSMNode)
      WHERE NOT EXISTS {
        MATCH (other:OSMWay)-[:HAS_NODE]->(n)
        WHERE elementId(other) <> elementId(w)
      }
      DETACH DELETE n
    `);

      await session.run(`
      MATCH (w:OSMWay {access: "private"})-[:HAS_NODE]->(n:OSMNode)
      WHERE NOT EXISTS {
        MATCH (other:OSMWay)-[:HAS_NODE]->(n)
        WHERE elementId(other) <> elementId(w)
      }
      DETACH DELETE n
    `);

      await session.run(`
      MATCH (w:OSMWay {highway: "footway"})-[:HAS_NODE]->(n:OSMNode)
      WHERE NOT EXISTS {
        MATCH (other:OSMWay)-[:HAS_NODE]->(n)
        WHERE elementId(other) <> elementId(w)
      }
      DETACH DELETE n
    `);

      await session.run(`
      MATCH (w:OSMWay {highway: "construction"})-[:HAS_NODE]->(n:OSMNode)
      WHERE NOT EXISTS {
        MATCH (other:OSMWay)-[:HAS_NODE]->(n)
        WHERE elementId(other) <> elementId(w)
      }
      DETACH DELETE n
    `);

      await session.run(`
      MATCH (w:OSMWay {highway: "track"})-[:HAS_NODE]->(n:OSMNode)
      WHERE NOT EXISTS {
        MATCH (other:OSMWay)-[:HAS_NODE]->(n)
        WHERE elementId(other) <> elementId(w)
      }
      DETACH DELETE n
    `);

      await session.run(`
      MATCH (w:OSMWay {surface: "dirt"})-[:HAS_NODE]->(n:OSMNode)
      WHERE NOT EXISTS {
        MATCH (other:OSMWay)-[:HAS_NODE]->(n)
        WHERE elementId(other) <> elementId(w)
      }
      DETACH DELETE n
    `);

      await session.run(`
      MATCH (w:OSMWay {highway: "proposed"})-[:HAS_NODE]->(n:OSMNode)
      WHERE NOT EXISTS {
        MATCH (other:OSMWay)-[:HAS_NODE]->(n)
        WHERE elementId(other) <> elementId(w)
      }
      DETACH DELETE n
    `);

      await session.run(`
      MATCH (w:OSMWay {highway: "pedestrian"})-[:HAS_NODE]->(n:OSMNode)
      WHERE NOT EXISTS {
        MATCH (other:OSMWay)-[:HAS_NODE]->(n)
        WHERE elementId(other) <> elementId(w)
      }
      DETACH DELETE n
    `);

      await session.run(`
      MATCH (w:OSMWay {service: "driveway"})-[:HAS_NODE]->(n:OSMNode)
      WHERE NOT EXISTS {
        MATCH (other:OSMWay)-[:HAS_NODE]->(n)
        WHERE elementId(other) <> elementId(w)
      }
      DETACH DELETE n
    `);

      await session.run(`
      MATCH (w:OSMWay {service: "alley"})-[:HAS_NODE]->(n:OSMNode)
      WHERE NOT EXISTS {
        MATCH (other:OSMWay)-[:HAS_NODE]->(n)
        WHERE elementId(other) <> elementId(w)
      }
      DETACH DELETE n
    `);

      await session.run(`
      MATCH (w:OSMWay {highway: "service"})-[:HAS_NODE]->(n:OSMNode)
      WHERE NOT EXISTS {
        MATCH (other:OSMWay)-[:HAS_NODE]->(n)
        WHERE elementId(other) <> elementId(w)
      }
      DETACH DELETE n
    `);

      await session.run(`
      MATCH (w:OSMWay {highway: "cycleway"})-[:HAS_NODE]->(n:OSMNode)
      WHERE NOT EXISTS {
        MATCH (other:OSMWay)-[:HAS_NODE]->(n)
        WHERE elementId(other) <> elementId(w)
      }
      DETACH DELETE n
    `);

      await session.run(`
      MATCH (w:OSMWay {highway: "living_street"})-[:HAS_NODE]->(n:OSMNode)
      WHERE NOT EXISTS {
        MATCH (other:OSMWay)-[:HAS_NODE]->(n)
        WHERE elementId(other) <> elementId(w)
      }
      DETACH DELETE n
    `);

      await session.run(`
      MATCH (w:OSMWay {highway: "path"})-[:HAS_NODE]->(n:OSMNode)
      WHERE NOT EXISTS {
        MATCH (other:OSMWay)-[:HAS_NODE]->(n)
        WHERE elementId(other) <> elementId(w)
      }
      DETACH DELETE n
    `);

      await session.run(`
      MATCH (w:OSMWay)-[:HAS_NODE]->(n:OSMNode)
      WHERE w.highway = "residential"
        AND w.access = "destination"
        AND NOT EXISTS {
          MATCH (other:OSMWay)-[:HAS_NODE]->(n)
          WHERE elementId(other) <> elementId(w)
        }
      DETACH DELETE n
    `);

      //   await session.run(`
      //     MATCH (w:OSMWay)-[:HAS_NODE]->(n:OSMNode)
      //     WITH w, collect(n) AS nodes
      //     WHERE size(nodes) = 1
      //     DELETE w
      //   `);
      //   await session.run(`
      //   MATCH (w:OSMWay)
      //   WHERE NOT (w)-[:HAS_NODE]->(:OSMNode)
      //   DELETE w
      // `);

      //   await session.run(`
      //     MATCH (n:OSMNode)
      //     WHERE NOT (n)--(:OSMNode)
      //     DELETE n
      //   `);

      console.log('✅ Limpeza concluída com sucesso.');
    } catch (error) {
      console.error('❌ Erro ao limpar o grafo:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async exportNodesPaged(skip = 0, limit = 100) {
    const session = this.session();
    try {
      // pega nós paginados
      const nodesRes = await session.run(
        `MATCH (n) RETURN n SKIP $skip LIMIT $limit`,
        { skip: neo4j.int(skip), limit: neo4j.int(limit) },
      );

      const nodes: any[] = nodesRes.records.map((r) => {
        const n = r.get('n');
        return {
          id: n.identity.toString(),
          labels: n.labels,
          properties: n.properties,
        };
      });

      const ids = nodes.map((x) => neo4j.int(x.id));
      // se não houver nós, retorna vazio
      if (ids.length === 0) return { nodes, relationships: [] };

      // obter relações entre esses nós
      // OBS: convertemos ids para string no serviço; aqui usamos MATCH por identidade numérica
      // Para performance, preferir query que filtre por ids listados:
      const relsRes = await session.run(
        `MATCH (a)-[r]->(b) WHERE id(a) IN $ids AND id(b) IN $ids RETURN r`,
        { ids: ids.map((i) => i) },
      );

      const relationships = relsRes.records.map((r) => {
        const rel = r.get('r');
        return {
          id: rel.identity.toString(),
          type: rel.type,
          startNodeId: rel.start.toString(),
          endNodeId: rel.end.toString(),
          properties: rel.properties,
        };
      });

      return { nodes, relationships };
    } finally {
      await session.close();
    }
  }

  async streamFullGraphRawRecords(onRecord: (obj: any) => Promise<void>) {
    const session = this.session();
    try {
      // stream por registros (n, r, m)
      const result = session.run(
        `MATCH (n) OPTIONAL MATCH (n)-[r]->(m) RETURN n, r, m`,
      );
      // o driver retorna result.records após resolved; para streaming real você precisa usar result.subscribe
      return new Promise<void>((resolve, reject) => {
        result.subscribe({
          onNext: async (record) => {
            // transforma record e envia
            const n = record.get('n');
            const r = record.get('r'); // pode ser null
            const m = record.get('m'); // pode ser null
            await onRecord({ n, r, m });
          },
          onCompleted: async () => {
            await session.close();
            resolve();
          },
          onError: async (err) => {
            await session.close();
            reject(err);
          },
        });
      });
    } catch (err) {
      await session.close();
      throw err;
    }
  }

  async importFromOverpass(query: string) {
    // chamar Overpass
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
    });
    const data = await res.json();

    const nodes = data.elements.filter((el: any) => el.type === 'node');
    const ways = data.elements.filter((el: any) => el.type === 'way');

    const session = this.driver.session();

    await session.run(
      `
      UNWIND $nodes AS n
      MERGE (node:OSMNode {id: n.id})
      SET node.lat = n.lat, node.lon = n.lon
      `,
      { nodes },
    );

    await session.run(
      `
      UNWIND $ways AS w
      MERGE (way:OSMWay {id: w.id})
      WITH w
      UNWIND range(0, size(w.nodes)-2) AS i
      MATCH (a:OSMNode {id: w.nodes[i]}),
            (b:OSMNode {id: w.nodes[i+1]})
      MERGE (a)-[:CONNECTED_TO]->(b)
      `,
      { ways },
    );

    await session.close();
  }

  async importFromFile(filePath: string) {
    // 1️⃣ ler arquivo XML
    const xml = fs.readFileSync(filePath, 'utf8');

    // 2️⃣ parse XML para JS
    const parsed = await xml2js.parseStringPromise(xml);

    const elements = parsed.osm;
    const rawNodes = elements.node || [];
    const rawWays = elements.way || [];

    // 3️⃣ transformar em objetos planos (evita uso de .$)
    const nodes = rawNodes.map((n: any) => ({
      id: parseInt(n.$.id),
      lat: parseFloat(n.$.lat),
      lon: parseFloat(n.$.lon),
    }));

    const ways = rawWays.map((w: any) => ({
      id: parseInt(w.$.id),
      nodes: w.nd.map((nd: any) => parseInt(nd.$.ref)),
    }));

    const session = this.driver.session();

    try {
      // 4️⃣ inserir nodes no Neo4j
      await session.run(
        `
        UNWIND $nodes AS n
        MERGE (node:OSMNode {id: n.id})
        SET node.lat = n.lat,
            node.lon = n.lon
        `,
        { nodes },
      );

      // 5️⃣ inserir edges (CONNECTED_TO)
      await session.run(
        `
        UNWIND $ways AS w
        UNWIND range(0, size(w.nodes)-2) AS i
        MATCH (a:OSMNode {id: w.nodes[i]}),
              (b:OSMNode {id: w.nodes[i+1]})
        MERGE (a)-[:CONNECTED_TO]->(b)
        `,
        { ways },
      );

      return {
        success: true,
        nodes: nodes.length,
        ways: ways.length,
      };
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

  private async insertIntoGraph({
    nodes,
    ways,
  }: {
    nodes: any[];
    ways: any[];
  }) {
    const session = this.driver.session();

    try {
      // MERGE garante que nodes duplicados não serão recriados
      await session.run(
        `
        UNWIND $nodes AS n
        MERGE (node:OSMNode {id: n.id})
        ON CREATE SET node.lat = n.lat, node.lon = n.lon
        ON MATCH SET node.lat = coalesce(node.lat, n.lat),
                     node.lon = coalesce(node.lon, n.lon)
        `,
        { nodes },
      );

      // 🔹 Cria relações entre nós (evita duplicadas com MERGE)
      await session.run(
        `
        UNWIND $ways AS w
        UNWIND range(0, size(w.nodes)-2) AS i
        MATCH (a:OSMNode {id: w.nodes[i]}),
              (b:OSMNode {id: w.nodes[i+1]})
        MERGE (a)-[:CONNECTED_TO]->(b)
        `,
        { ways },
      );

      return {
        success: true,
        nodes: nodes.length,
        ways: ways.length,
      };
    } finally {
      await session.close();
    }
  }

  //ways
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

  async createSemaforoOnNode(
    nodeId: string,
    semaforoData: SemaforoDto,
    wayId: string,
  ) {
    const session = this.session(true);
    try {
      const semaforoNode = await session.writeTransaction(async (tx) => {
        const nodeCheck = await tx.run(
          `MATCH (n:OSMNode) WHERE elementId(n) = $nodeId RETURN n`,
          { nodeId },
        );

        if (nodeCheck.records.length === 0) {
          throw new Error('Nó não encontrado');
        }

        const checkSemaforo = await tx.run(
          `MATCH (n:Semaforo {deviceId: $deviceId}) RETURN n`,
          { deviceId: semaforoData.deviceId },
        );

        if (checkSemaforo.records.length > 0) {
          throw new Error('DeviceId already in use');
        }

        const cleanSemaforoData = Object.fromEntries(
          Object.entries(semaforoData).filter(
            ([key, value]) =>
              value !== undefined &&
              !['createdAt', 'updatedAt', 'ip', 'macAddress'].includes(key),
          ),
        );

        const result = await tx.run(
          `
        MATCH (n:OSMNode) WHERE elementId(n) = $nodeId
        MERGE (s:Semaforo {deviceId: $deviceId})
        SET s += $cleanSemaforoData
        MERGE (n)-[:HAS_SEMAFORO]->(s)
        WITH s
        OPTIONAL MATCH (w:OSMWay ) WHERE elementId(w) = $wayId
        MERGE (s)-[:CONTROLS_TRAFFIC_ON]->(w)
        RETURN s, w
        `,
          { nodeId, deviceId: semaforoData.deviceId, cleanSemaforoData, wayId },
        );
        await tx.commit();
        const semaforo = result.records[0]?.get('s');
        if (!semaforo) {
          throw new Error('Erro ao criar ou vincular semáforo');
        }

        return semaforo;
      });

      return semaforoNode;
    } catch (error) {
      console.error('Erro ao criar semáforo:', error);
      throw error;
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
        await tx.commit()
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
}
