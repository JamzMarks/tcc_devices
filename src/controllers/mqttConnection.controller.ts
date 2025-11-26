import { Controller, Get, Query } from "@nestjs/common";
import { MqttConnectionService } from "src/services/mqttConnection.service";


@Controller("mqtt")
export class MqttController {
  constructor(private readonly mqttService: MqttConnectionService) {}

  @Get("credentials")
  async getCredentials(@Query("mac") mac: string) {
    return this.mqttService.getMqttCredentialsByMac(mac);
  }

  @Get("time")
  async getServerTime() {
    return this.mqttService.getServerTime();
  }
}
