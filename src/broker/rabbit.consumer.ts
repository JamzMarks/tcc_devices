// rabbit.consumer.ts

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '@services/rabbit.service';
import { WebSocketService } from '@services/webSocket.service';
import { WebSocketGatewayMain } from 'src/webSocket.gateway';


@Injectable()
export class RabbitConsumerService implements OnModuleInit {
  private logger = new Logger(RabbitConsumerService.name);

  constructor(
    private readonly rabbit: RabbitMQService,
    private readonly wsService: WebSocketService,
    private readonly wsGateway: WebSocketGatewayMain,
  ) {}

  async onModuleInit() {
    await this.setupConsumer();
  }

  private async setupConsumer() {
    this.logger.log('Iniciando consumer de orchestrator.to.iot...');

    await this.rabbit.consumerChannel.addSetup(async channel => {

      await channel.assertExchange('signal.events', 'topic', { durable: true });

      await channel.assertQueue('orchestrator.to.iot', { durable: true });

      await channel.bindQueue(
        'orchestrator.to.iot',
        'signal.events',
        'signal.update.*',
      );

      await channel.consume(
        'orchestrator.to.iot',
        async msg => {
          if (!msg) return;

          const content = JSON.parse(msg.content.toString());
          this.logger.log('Mensagem recebida do Orquestrador:', content);

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

    await this.wsGateway.emitStatusUpdate(semaforoId, status);
  } 

}
