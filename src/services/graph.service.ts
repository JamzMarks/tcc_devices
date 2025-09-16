import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import neo4j, { Driver, Session } from 'neo4j-driver';

@Injectable()
export class GraphService implements OnModuleInit, OnModuleDestroy {
  private driver: Driver;
  private uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  private user = process.env.NEO4J_USERNAME || 'neo4j';
  private pass = process.env.NEO4J_PASSWORD || 'neo4j';

  onModuleInit() {
    this.driver = neo4j.driver(this.uri, neo4j.auth.basic(this.user, this.pass));
  }

  async onModuleDestroy() {
    if (this.driver) await this.driver.close();
  }

  private session(): Session {
    return this.driver.session({ defaultAccessMode: neo4j.session.READ });
  }

  /**
   * Exporta TODO o grafo — retorna { nodes: [], relationships: [] }.
   * WARNING: para grafos enormes pode consumir muita memória.
   */
  async exportFullGraph(): Promise<{ nodes: any[]; relationships: any[] }> {
    const session = this.session();
    try {
      // Colete nós
      const nodesResult = await session.run(
        `MATCH (n) RETURN DISTINCT n`
      );
      const nodesMap = new Map<string, any>();
      for (const rec of nodesResult.records) {
        const node = rec.get('n');
        const id = node.identity.toString();
        nodesMap.set(id, {
          id,
          labels: node.labels,
          properties: node.properties,
        });
      }

      // Colete relações
      const relsResult = await session.run(
        `MATCH ()-[r]->() RETURN DISTINCT r`
      );
      const relationships: any[] = [];
      for (const rec of relsResult.records) {
        const r = rec.get('r');
        relationships.push({
          id: r.identity.toString(),
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

  /**
   * Paginação simples de nós. Também retorna as relações entre esses nós (apenas relações
   * cujos endpoints estão presentes no conjunto de nós retornados).
   */
  async exportNodesPaged(skip = 0, limit = 100) {
    const session = this.session();
    try {
      // pega nós paginados
      const nodesRes = await session.run(
        `MATCH (n) RETURN n SKIP $skip LIMIT $limit`,
        { skip: neo4j.int(skip), limit: neo4j.int(limit) }
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
        { ids: ids.map((i) => i) }
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

  /**
   * Stream export to CSV (nodes + relationships) using a query streaming style.
   * Implementação simples: escreve linhas CSV no response (controlado pelo controller).
   */
  async streamFullGraphRawRecords(onRecord: (obj: any) => Promise<void>) {
    const session = this.session();
    try {
      // stream por registros (n, r, m)
      const result = session.run(`MATCH (n) OPTIONAL MATCH (n)-[r]->(m) RETURN n, r, m`);
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
}
