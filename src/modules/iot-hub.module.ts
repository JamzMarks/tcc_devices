// iot-hub.module.ts
import { Module } from '@nestjs/common';
import { IoTHubService } from '@services/iot-hub.service';

@Module({
  providers: [IoTHubService],
  exports: [IoTHubService],
})
export class IoTHubModule {}
