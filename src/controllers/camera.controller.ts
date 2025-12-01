import { CameraLinkDto } from '@dtos/camera/cameraLink.dto';
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Version,
} from '@nestjs/common';
import { CameraService } from 'src/services/camera.service';

@Controller('camera')
export class CameraController {
  constructor(private readonly cameraService: CameraService) {}

  @Get()
  @Version('1')
  getAll() {
    return this.cameraService.getAllCameras();
  }

  @Get(':id')
  @Version('1')
  getOne(@Param('id') id: string) {
    return this.cameraService.getCamera(id);
  }

  @Post()
  @Version('1')
  create(@Body() body: { deviceId: string; ip: string; type: string }) {
    return this.cameraService.createCamera(body);
  }

  // @Put(':id')
  // @Version('1')
  // update(
  //   @Param('id') id: string,
  //   @Body() body: { macAddress?: string; deviceId?: string; isActive?: boolean },
  // ) {
  //   return this.cameraService.updateCamera(
  //     Number(id),
  //     body.macAddress,
  //     body.deviceId,
  //     body.isActive,
  //   );
  // }

  @Delete(':id')
  @Version('1')
  delete(@Param('id') id: string) {
    return this.cameraService.deleteCamera(id);
  }

  @Post(':deviceId/link')
  @Version('1')
  async linkDeviceToNode(
    @Param('deviceId') deviceId: string,
    @Body()
    body: CameraLinkDto
  ) {
    console.log('Linking camera to nodes:', deviceId, body);
    const semaforo = await this.cameraService.linkCamera(
      deviceId,
      body.nodeId,
      body.siblingId,
      body.wayId
    );
    return semaforo;
  }
}
