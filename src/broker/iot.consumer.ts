import { Injectable, Logger } from '@nestjs/common';
import { IoTHubService } from '@services/iot-hub.service';
import * as amqp from 'amqplib';


@Injectable()
export class IoTConsumer {
  private readonly logger = new Logger(IoTConsumer.name);

  constructor(private readonly iotHub: IoTHubService) {
    this.bootstrap();
  }

  async bootstrap() {
    const conn = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await conn.createChannel();

    await channel.assertExchange('signal.events', 'topic', { durable: true });
    const queue = await channel.assertQueue('iot.dispatcher', { durable: true });

    // Vai escutar oq o Go está enviando
    await channel.bindQueue(queue.queue, 'signal.events', 'signal.update.*');

    this.logger.log('Consumer IoT iniciado…');

    channel.consume(queue.queue, async (msg) => {
      if (!msg) return;

      try {
        const data = JSON.parse(msg.content.toString());
        const { deviceId, cycleCommand } = data;

        this.logger.log(`Rabbit → IoT: ${deviceId}`);

        await this.iotHub.sendToDevice(deviceId, cycleCommand);

        channel.ack(msg);
      } catch (error) {
        this.logger.error('Erro processando mensagem IoT:', error);
        channel.nack(msg, false, false);
      }
    });
  }
}
