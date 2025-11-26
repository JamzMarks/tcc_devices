// rabbit.consumer.ts

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { IoTHubService } from '@services/iot-hub.service';
import { RabbitMQService } from '@services/rabbit.service';
import { WebSocketService } from '@services/webSocket.service';
import { DeviceCommand } from '@Types/device.command';
import { WebSocketGatewayMain } from 'src/webSocket.gateway';

@Injectable()
export class RabbitConsumerService implements OnModuleInit {
  private logger = new Logger(RabbitConsumerService.name);

  private readonly EXCHANGE = 'signal.events';
  private readonly QUEUE = 'orchestrator.to.iot';
  private readonly ROUTING_KEY = 'signal.update.*';

  constructor(
    private readonly rabbit: RabbitMQService,
    private readonly wsService: WebSocketService,
    private readonly wsGateway: WebSocketGatewayMain,
    private readonly iotHubService: IoTHubService
  ) {}

  async onModuleInit() {
    await this.rabbit.waitUntilConnected(); 
    await this.setupConsumer();
    console.log('Sistema funcionando com RabbitMQ');
  }

  private async setupConsumer() {
    this.logger.log('Iniciando consumer de orchestrator.to.iot...');

    await this.rabbit.consumerChannel.addSetup(async channel => {

      await channel.assertExchange(this.EXCHANGE, 'topic', { durable: true });

      await channel.assertQueue(this.QUEUE, { durable: true });

      await channel.bindQueue(this.QUEUE, this.EXCHANGE, this.ROUTING_KEY);

      // 🔥 LOGS DE CONFIGURAÇÃO
      console.log('🔧 RabbitMQ Listener Registrado:');
      console.log(`➡ Exchange: ${this.EXCHANGE} (tipo: topic)`);
      console.log(`➡ Queue: ${this.QUEUE}`);
      console.log(`➡ Routing key ouvindo: ${this.ROUTING_KEY}`);
      console.log('----------------------------------------------');

      await channel.consume(
        this.QUEUE,
        async msg => {
          if (!msg) return;

          const content = JSON.parse(msg.content.toString());

          console.log('📩 [Rabbit] Mensagem recebida:');
          console.log(content);

          await this.handleMessage(content);

          channel.ack(msg);
        },
        { noAck: false },
      );

      console.log('🐇 Consumer ativo! Aguardando mensagens...');
      console.log('==============================================');
    });
  }

  async handleMessage(msg: DeviceCommand) {
    try {
      console.log(`🎯 Processando -> semaforoId=${msg.deviceId}`);

      const listeners = await this.wsService.getListeners(msg.deviceId);
      // await this.iotHubService.sendToDevice(msg.deviceId, msg);
      console.log(`passou pelo iothub`)
      if (listeners.size === 0) {
        this.logger.log(`Ninguém ouvindo ${msg.deviceId}`);
        return;
      }


      await this.wsGateway.emitStatusUpdate(msg);

    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error);
      console.error('🗑 Conteúdo da mensagem com erro:', msg);
    }
  }
}



