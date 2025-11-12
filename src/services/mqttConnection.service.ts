import { Injectable, NotFoundException } from '@nestjs/common';

import * as crypto from 'crypto';
import { PrismaService } from './prisma.service';
import { MqttCredentialsDto } from '@dtos/mqtt.dto';

@Injectable()
export class MqttConnectionService {
  private readonly apiVersion = '2021-04-12';
  private readonly iotHubHostName: string = process.env.IOT_HUB_HOST!;
  constructor(private readonly prisma: PrismaService) {}

  async getMqttCredentialsByMac(macAddress: string): Promise<MqttCredentialsDto> {
    const semaforo = await this.prisma.semaforo.findUnique({
      where: { macAddress },
    });

    if (!semaforo) throw new NotFoundException('Semáforo não encontrado');

    const pack = await this.prisma.pack.findFirst({
      where: {
        OR: [
          {
            semaforos: {
              some: { id: semaforo.id },
            },
          },
          {
            subPacks: {
              some: {
                semaforos: {
                  some: { id: semaforo.id },
                },
              },
            },
          },
        ],
      },
      include: {
        subPacks: {
          include: {
            semaforos: true,
          },
        },
        semaforos: true,
      },
    });

    const sasToken = this.generateSasToken(
      process.env.AZURE_IOTHUB_HOSTNAME!,
      semaforo.deviceId,
      semaforo.deviceKey,
      60 * 60,
    );

    return {
      ...semaforo,
      iotHubHost: this.iotHubHostName,
      sasToken,
      current_config: {
        green_start: 0,
        green_duration: 120,
        cycle_total: 240,
      }
    };
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

  // async mockSemaforos(){
  //   const base = 60;
  //   const variation = Math.floor(Math.random() * 30);
  //   const flip = Math.random() > 0.5;

  //   if (deviceId === "teste1") {
  //     this.states["teste1"] = {
  //       green: base + (flip ? variation : 0),
  //       red: base + (!flip ? variation : 0),
  //     };
  //     this.states["teste2"] = {
  //       green: base + (!flip ? variation : 0),
  //       red: base + (flip ? variation : 0),
  //     };
  //   }

  //   if (deviceId === "teste2") {

  //     return this.states["teste2"];
  //   }

  //   return this.states[deviceId];
  // }
}
