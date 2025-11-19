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
  constructor(private configService: ConfigService){

  }
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

    // Canal para produzir
    this.publisherChannel = this.connection.createChannel({
      json: true,
      setup: async (channel: ConfirmChannel) => {
        await channel.assertExchange('traffic-light', 'topic', {
          durable: true,
        });
      },
    });

    // Canal para consumir
    this.consumerChannel = this.connection.createChannel({
      json: true,
    });
  }
}
