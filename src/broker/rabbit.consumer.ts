// rabbit.consumer.ts

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '@services/rabbit.service';
import { WebSocketService } from '@services/webSocket.service';


@Injectable()
export class RabbitConsumerService implements OnModuleInit {
  private logger = new Logger(RabbitConsumerService.name);

  constructor(
    private readonly rabbit: RabbitMQService,
    private readonly wsService: WebSocketService,
  ) {}

  async onModuleInit() {
    await this.setupConsumer();
  }

  private async setupConsumer() {
    this.logger.log('Iniciando consumer de traffic-light.updates...');

    await this.rabbit.consumerChannel.addSetup(async channel => {
      await channel.assertExchange('traffic-light', 'topic', {
        durable: true,
      });

      await channel.assertQueue('traffic-light.updates', {
        durable: true,
      });

      await channel.bindQueue(
        'traffic-light.updates',
        'traffic-light',
        'update.*',
      );

      await channel.consume(
        'traffic-light.updates',
        async msg => {
          if (!msg) return;

          const content = JSON.parse(msg.content.toString());
          this.logger.log('Mensagem recebida:', content);

          await this.handleMessage(content);

          channel.ack(msg);
        },
        { noAck: false },
      );
    });
  }

  async handleMessage(msg: any) {
    const { semaforoId, status } = msg;

    const listeners = await this.wsService.getListeners(semaforoId);

    if (listeners.size === 0) {
      this.logger.log(`Ninguém ouvindo ${semaforoId}`);
      return;
    }

    // Envia para todos os sockets
    // for (const socketId of listeners) {
    //   this.wsService.server
    //     .to(socketId)
    //     .emit('statusUpdate', { semaforoId, status });
    // }
  }
}
