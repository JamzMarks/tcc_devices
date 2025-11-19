import { SemaforoConfig } from "@Types/semaforo-config";
import { SemaforoDto } from "./semaforos/semaforo.dto";

export type MqttCredentialsDto = SemaforoDto & {
  iotHubHost: string;
  sasToken: string;
  current_config: SemaforoConfig;
};