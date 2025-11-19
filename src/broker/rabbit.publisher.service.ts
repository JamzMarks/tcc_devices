
import { Injectable } from '@nestjs/common';
import { RabbitMQService } from '@services/rabbit.service';

@Injectable()
export class RabbitPublisherService {
  constructor(private readonly rabbit: RabbitMQService) {}

  async publishUpdate(semaforoId: string, status: string) {
    await this.rabbit.publisherChannel.publish(
      'traffic-light',
      `update.${semaforoId}`,
      {
        semaforoId,
        status,
      },
    );
  }
}
