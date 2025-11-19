import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import neo4j, { Driver, Session } from 'neo4j-driver';

@Injectable()
export class Neo4jService implements OnModuleInit, OnModuleDestroy {
  private driver: Driver;
  private uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  private user = process.env.NEO4J_USERNAME || 'neo4j';
  private pass = process.env.NEO4J_PASSWORD || 'neo4j';

  async onModuleInit() {
    this.driver = neo4j.driver(
      this.uri,
      neo4j.auth.basic(this.user, this.pass),
    );
  }

  async onModuleDestroy() {
    await this.driver?.close();
  }

  getReadSession(): Session {
    return this.driver.session({ defaultAccessMode: neo4j.session.READ });
  }

  getWriteSession(): Session {
    return this.driver.session({ defaultAccessMode: neo4j.session.WRITE });
  }
}
