import { Module } from '@nestjs/common';
import { WebSocketGatewayMain } from '../webSocket.gateway';
import { WebSocketService } from '@services/webSocket.service';


@Module({
  providers: [WebSocketService, WebSocketGatewayMain],
  exports: [WebSocketService, WebSocketGatewayMain],
})
export class WebSocketModule {}
