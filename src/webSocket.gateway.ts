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

@WebSocketGateway({ cors: true,
  pingInterval: 30000, 
  pingTimeout: 20000,  
})
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
    @MessageBody() payload: { deviceId: string },
  ) {
    console.log(
      `Cliente ${client.id} quer ouvir semáforo ${payload.deviceId}`,
    );
    await this.wsService.addListener(payload.deviceId, client.id);
  }

  // Função para enviar atualização de status para clientes
  async emitStatusUpdate(msg: any) {
    const { deviceId } = msg;

    const sockets = await this.wsService.getListeners(deviceId);

    console.log(`🔔 Emitindo status para ${sockets.size} clientes`);

    for (const socketId of sockets) {
      const socket = this.server.sockets.sockets.get(socketId);

      if (socket) {
        socket.emit('statusUpdate', msg); // 🔥 envia a mensagem inteira
      } else {
        // Remove sockets invalidados
        await this.wsService.removeSocketFromAll(socketId);
      }
    }
  }
}
