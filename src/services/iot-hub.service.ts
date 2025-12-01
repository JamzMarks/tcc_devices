import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DeviceCommand, IotHubCommand } from '@Types/device.command';
import { Client } from 'azure-iothub';
import { Message } from 'azure-iothub/dist/common-core/message';

@Injectable()
export class IoTHubService implements OnModuleInit {
  private readonly logger = new Logger(IoTHubService.name);
  private client: Client;

  constructor() {
    const conn = process.env.AZURE_IOTHUB_CONNECTION_STRING!;
    this.client = Client.fromConnectionString(conn);
  }

  async onModuleInit() {
    try {
      await this.client.open();
      this.logger.log('Client C2D conectado');
    } catch (err) {
      this.logger.error('Falha ao conectar client C2D: ', err);
    }
  }

  async sendToDevice(deviceId: string, payload: IotHubCommand) {
    const msg = new Message(JSON.stringify(payload));

    this.logger.log(`Enviando C2D → ${deviceId}`);
    this.logger.debug(msg);

    try {
      await Promise.race([
        this.client.send(deviceId, msg),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout enviando C2D')), 15000),
        ),
      ]);

      this.logger.log(`C2D enviado → ${deviceId}`);
    } catch (err: any) {
      this.logger.error(
        `Erro enviando C2D para ${deviceId}: ${err.message || err}`,
      );
      throw err;
    }
  }
}
