import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { WebSocketService } from '@services/webSocket.service';
import { Server, Socket } from 'socket.io';


@WebSocketGateway(3010, {})
export class WebSocketGatewayMain
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(private readonly wsService: WebSocketService) {}

  handleConnection(client: Socket) {
    console.log(`Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Cliente desconectado: ${client.id}`);
    this.wsService.removeSocketFromAll(client.id);
  }

  // Recebe do front o interesse em um semáforo
  @SubscribeMessage('listen')
  async handleListen(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { semaforoId: string },
  ) {
    console.log(`Cliente ${client.id} quer ouvir semáforo ${payload.semaforoId}`);
    await this.wsService.addListener(payload.semaforoId, client.id);
  }

  // Função para enviar atualização de status para clientes
  async emitStatusUpdate(semaforoId: string, status: any) {
    const sockets = await this.wsService.getListeners(semaforoId);
    for (const socketId of sockets) {
      this.server.to(socketId).emit('statusUpdate', { semaforoId, status });
    }
  }
}
