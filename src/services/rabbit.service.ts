import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AmqpConnectionManager,
  ChannelWrapper,
  connect,
} from 'amqp-connection-manager';
import { ConfirmChannel } from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit {
  private logger = new Logger(RabbitMQService.name);

  private connection: AmqpConnectionManager;
  public publisherChannel: ChannelWrapper;
  public consumerChannel: ChannelWrapper;

  constructor(private configService: ConfigService) {}
  
  async onModuleInit() {
    const amqpUrl = this.configService.get<string>('AMQP_URL');
    this.logger.log('Conectando ao RabbitMQ...');

    this.connection = connect([amqpUrl]);

    this.connection.on('connect', () =>
      this.logger.log('Conectado ao RabbitMQ!'),
    );

    this.connection.on('disconnect', err =>
      this.logger.error('Desconectado do RabbitMQ!', err),
    );

    // CRIA CANAL DE PRODUÇÃO
    this.publisherChannel = this.connection.createChannel({
      json: true,
      setup: async (channel: ConfirmChannel) => {
        await channel.assertExchange('traffic-light', 'topic', {
          durable: true,
        });
      },
    });

    // CRIA CANAL DE CONSUMO
    this.consumerChannel = this.connection.createChannel({
      json: true,
    });
  }

  async waitUntilConnected(): Promise<void> {
    if (this.connection?.isConnected()) return;

    await new Promise<void>((resolve) => {
      this.connection.once('connect', () => resolve());
    });
  }
}

// import { Injectable } from '@nestjs/common';
// import { connect, Connection, Channel } from 'amqplib';

// @Injectable()
// export class RabbitMQService {
//   private connection: Connection;
//   public channel: Channel;

//   async connect() {
//     const amqpUrl = 'amqp://user:pass@localhost:5672'; 

//     this.connection = await connect(amqpUrl);
//     this.channel = await this.connection.createChannel();

//     console.log('[RabbitMQ] Conectado');
//   }
// }