import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'azure-iothub';
import { Message } from 'azure-iothub/dist/common-core/message';


@Injectable()
export class IoTHubService {
  private readonly logger = new Logger(IoTHubService.name);
  private client: Client;

  constructor() {
    const conn = process.env.IOT_HUB_SERVICE_CONNECTION!;
    this.client = Client.fromConnectionString(conn);
  }

  async sendToDevice(deviceId: string, payload: any) {
    const msg = new Message(JSON.stringify(payload));

    try {
      await this.client.open();
      await this.client.send(deviceId, msg);
      this.logger.log(`C2D enviado → ${deviceId}`);
    } catch (err) {
      this.logger.error(`Erro enviando C2D para ${deviceId}`, err);
      throw err;
    } finally {
      await this.client.close();
    }
  }
}
