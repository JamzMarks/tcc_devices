import { Module, Global } from '@nestjs/common';
import { RabbitMQService } from '@services/rabbit.service';
import { RabbitConsumerService } from '../broker/rabbit.consumer';
import { ConfigModule } from '@nestjs/config';
import { WebSocketModule } from './webSocket.module';

@Global()
@Module({
  imports: [WebSocketModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  providers: [RabbitMQService, RabbitConsumerService],
  exports: [RabbitMQService ],
})
export class RabbitMQModule {}