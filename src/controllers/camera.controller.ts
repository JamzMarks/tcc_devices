import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { CameraService } from 'src/services/camera.service';


@Controller('camera')
export class CameraController {
  constructor(private readonly cameraService: CameraService) {}


  @Get()
  getAll() {
    return this.cameraService.getAllCameras();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.cameraService.getCamera(Number(id));
  }

  @Post()
  create(@Body() body: { macAddress: string; deviceId: string, ip: string}) {
    return this.cameraService.createCamera(body.macAddress, body.deviceId, body.ip);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: { macAddress?: string; deviceId?: string; isActive?: boolean },
  ) {
    return this.cameraService.updateCamera(
      Number(id),
      body.macAddress,
      body.deviceId,
      body.isActive,
    );
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.cameraService.deleteCamera(Number(id));
  }
}
