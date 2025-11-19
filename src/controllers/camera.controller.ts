import { Controller, Get, Post, Put, Delete, Param, Body, Version } from '@nestjs/common';
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
  create(@Body() body: { macAddress: string; deviceId: string, ip: string}) {
    return this.cameraService.createCamera(body.macAddress, body.deviceId, body.ip);
  }

  @Put(':id')
  @Version('1')
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
  @Version('1')
  delete(@Param('id') id: string) {
    return this.cameraService.deleteCamera(id);
  }
}
