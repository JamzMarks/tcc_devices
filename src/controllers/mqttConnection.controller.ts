import { Controller, Get, HttpStatus, Query, Res } from '@nestjs/common';
import { MqttConnectionService } from 'src/services/mqttConnection.service';
import { Response } from 'express';
@Controller('mqtt')
export class MqttController {
  constructor(private readonly mqttService: MqttConnectionService) {}

  @Get('credentials')
  async getCredentials(@Query('mac') mac: string) {
    return this.mqttService.getMqttCredentialsByMac(mac);
  }

  @Get('time')
  async getServerTime(@Res() res: Response) {
    try {
      const data = await this.mqttService.getServerTime();
      return res.status(HttpStatus.OK).json(data);
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: 'Erro exportando grafo', error: err.message });
    }
  }
}
