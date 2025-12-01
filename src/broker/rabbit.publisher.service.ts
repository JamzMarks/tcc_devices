
import { Injectable } from '@nestjs/common';
import { RabbitMQService } from '@services/rabbit.service';

@Injectable()
export class RabbitPublisherService {
  private readonly EXCHANGE = 'traffic-light';
  private readonly EXCHANGE_ERROR = 'error-events';
  constructor(private readonly rabbit: RabbitMQService) {}

  async publishUpdate(semaforoId: string, status: string) {
    await this.rabbit.publisherChannel.publish(
      this.EXCHANGE,
      `update.${semaforoId}`,
      {
        semaforoId,
        status,
      },
    );
  }

  async publishError(semaforoId: string, errorMessage: string) {
    await this.rabbit.publisherChannel.publish(
      this.EXCHANGE_ERROR,
      `error.${semaforoId}`,
      {
        semaforoId,
        error: errorMessage,
        timestamp: Date.now(),
      },
    );
  }
}
