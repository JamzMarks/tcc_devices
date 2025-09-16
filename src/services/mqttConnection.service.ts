import { Injectable, NotFoundException } from "@nestjs/common";

import * as crypto from "crypto";
import { PrismaService } from "./prisma.service";

@Injectable()
export class MqttConnectionService {
  private readonly iotHubHost = process.env.IOT_HUB_HOST!;
  private readonly apiVersion = "2021-04-12";

  constructor(private readonly prisma: PrismaService) {}

  private generateSasToken(deviceId: string, deviceKey: string, ttlSeconds: number): string {
    const resourceUri = `${this.iotHubHost}/devices/${deviceId}`;
    const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;

    const stringToSign = `${encodeURIComponent(resourceUri)}\n${expiry}`;
    const hmac = crypto.createHmac("sha256", Buffer.from(deviceKey, "base64"));
    hmac.update(stringToSign);
    const signature = encodeURIComponent(hmac.digest("base64"));

    return `SharedAccessSignature sr=${encodeURIComponent(resourceUri)}&sig=${signature}&se=${expiry}`;
  }


  async getMqttCredentialsByMac(macAddress: string) {
    const device = await this.prisma.semaforo.findUnique({
      where: { macAddress },
    });

    if (!device) {
      throw new NotFoundException("Dispositivo não encontrado");
    }

    // TTL de 2 dias = 172800 segundos
    const sasToken = this.generateSasToken(device.deviceId, device.deviceKey, 60 * 60 * 24 * 2);

    return {
      clientId: device.deviceId,
      broker: this.iotHubHost,
      port: 8883,
      username: `${this.iotHubHost}/${device.deviceId}/?api-version=${this.apiVersion}`,
      password: sasToken,
      topics: {
        events: `devices/${device.deviceId}/messages/events/`,
        commands: `devices/${device.deviceId}/messages/devicebound/#`,
      },
      expiresIn: "2 days",
    };
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
