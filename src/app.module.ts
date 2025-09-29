import { Module } from '@nestjs/common';

import { SemaforoService } from './services/semaforo.service';
import { PrismaService } from './services/prisma.service';
import { PackService } from './services/pack.service';
import { CameraService } from './services/camera.service';
import { CameraController } from './controllers/camera.controller';
import { PackController } from './controllers/pack.controller';
import { SemaforoController } from './controllers/semaforo.controller';
import { GraphService } from './services/graph.service';
import { GraphController } from './controllers/graph.controller';
import { MqttConnectionService } from './services/mqttConnection.service';
import { MqttController } from './controllers/mqttConnection.controller';
import { SchemaController } from '@controllers/schema.controller';
import { SchemaService } from '@services/schema.service';

@Module({
  imports: [],
  controllers: [CameraController, PackController, SemaforoController, GraphController, MqttController, SchemaController],
  providers: [SemaforoService, PrismaService, PackService, CameraService, GraphService, MqttConnectionService, SchemaService],
})
export class AppModule {}
