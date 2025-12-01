import { Injectable, NotFoundException } from '@nestjs/common';

import * as crypto from 'crypto';
import { MqttCredentialsDto } from '@dtos/mqtt.dto';
import { SemaforoService } from './semaforo.service';
import { Neo4jService } from './neo4j.service';
import { mapNode } from '@utils/formatters/neo4j-formatters';
 import { Integer } from "neo4j-driver";
@Injectable()
export class MqttConnectionService {
  private readonly apiVersion = '2021-04-12';
  private readonly iotHubHostName: string = process.env.IOT_HUB_HOST!;
  constructor(private readonly semaforoService: SemaforoService, private readonly neo4j: Neo4jService) {}

  async getMqttCredentialsByMac(macAddress: string): Promise<MqttCredentialsDto> {
    const session = this.neo4j.getReadSession();

    try {
      // Buscar semáforo e seus packs/subpacks
      const result = await session.run(
        `
        MATCH (s:Semaforo { macAddress: $mac })

        // Pack -> Semáforo (direto)
        OPTIONAL MATCH (p1:Pack)-[:HAS_SEMAFORO]->(s)

        // Pack -> SubPack -> Semáforo
        OPTIONAL MATCH (p2:Pack)-[:HAS_SUBPACK]->(sp:SubPack)-[:HAS_SEMAFORO]->(s)

        WITH s,
            collect(DISTINCT p1) + collect(DISTINCT p2) AS packs,
            collect(DISTINCT sp) AS subPacks

        RETURN s, packs, subPacks
        `,
        { mac: macAddress },
      );

      if (!result.records.length) {
        throw new NotFoundException('Semáforo não encontrado');
      }

      const record = result.records[0];
      console.log(record)
      const s = record.get('s');
      const packs = record.get('packs');
      const subPacks = record.get('subPacks');
      const semaforo = mapNode(s);
      const pack = packs.length > 0 ? packs[0].properties : null;
      const subPack = subPacks.length > 0 ? subPacks[0].properties : null;
      const green_start = this.toNumber(subPack?.green_start ?? semaforo.green_start ?? 0);
      const green_duration = this.toNumber(subPack?.green_duration ?? semaforo.green_duration ?? 60);
      const sasToken = this.generateSasToken(
        process.env.AZURE_IOTHUB_HOSTNAME!,
        semaforo.deviceId,
        semaforo.deviceKey,
        60 * 60,
      );
      const now = Math.floor(Date.now() / 1000);
      return {
        ...semaforo,
        iotHubHost: this.iotHubHostName,
        sasToken,
        current_config: {
          green_start: green_start,
          green_duration: green_duration,
          cycle_total: pack.cicle,
          serverIssuedAt: now,
        },
        pack: pack ? { ...pack, subPacks } : null,
      };
    } finally {
      await session.close();
    }
  }
  
  private generateSasToken(
    iotHubHostName: string,
    deviceId: string,
    deviceKey: string,
    ttlSeconds: number,
  ): string {
    const resourceUri = `${iotHubHostName}/devices/${deviceId}`;
    const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;

    const stringToSign = encodeURIComponent(resourceUri) + '\n' + expiry;
    const hmac = crypto.createHmac('sha256', Buffer.from(deviceKey, 'base64'));
    hmac.update(stringToSign);
    const signature = hmac.digest('base64');

    return `SharedAccessSignature sr=${encodeURIComponent(
      resourceUri,
    )}&sig=${encodeURIComponent(signature)}&se=${expiry}`;
  }

  public getServerTime() {
    return {
      epoch_ms: Date.now(),      
      epoch_s: Math.floor(Date.now() / 1000),
      iso: new Date().toISOString(),
    };
  }

  private toNumber(value: any): number {
    if (value == null) return 0;
    return Integer.isInteger(value) ? value.toNumber() : value;
  };
}
