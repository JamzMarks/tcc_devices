import { SemaforoFilters } from '@dtos/semaforos/semaforo-filters.dto';
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Version,
  Res,
} from '@nestjs/common';
import { SemaforoDto } from '@dtos/semaforos/semaforo.dto';
import { SemaforoService } from 'src/services/semaforo.service';
import { CreateSemaforoDto } from '@dtos/semaforos/create-semafoto.dto';

@Controller('semaforo')
export class SemaforoController {
  constructor(private readonly semaforoService: SemaforoService) {}

  @Get()
  @Version('1')
  getAll(@Query() filters: SemaforoFilters) {
    return this.semaforoService.getAllSemaforos(filters);
  }

  @Get(':id')
  @Version('1')
  getOne(@Param('id') id: string) {
    return this.semaforoService.getSemaforo(id);
  }

  @Post()
  @Version('1')
  create(@Body() body: CreateSemaforoDto) {
    return this.semaforoService.createSemaforo(body);
  }

  @Put(':id')
  @Version('1')
  update(@Param('id') id: string, @Body() body: Partial<SemaforoDto>) {
    return this.semaforoService.updateSemaforo(Number(id), body);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.semaforoService.deleteSemaforo(Number(id));
  }

  @Get('mac/:macAddress')
  @Version('1')
  getByMac(@Param('macAddress') macAddress: string) {
    return this.semaforoService.getByMacAdress(macAddress);
  }

  @Post(':deviceId/link')
  @Version('1')
  async linkSemaforoToNode(
    @Param('deviceId') deviceId: string,
    @Body() body: { nodeId: string; wayId: string },
  ) {
    const { nodeId, wayId } = body;

    const semaforo = await this.semaforoService.linkSemaforo(
      nodeId,
      deviceId,
      wayId,
    );
    return semaforo;
  }

  @Post(':id/unlink')
  @Version('1')
  async unlinkSemaforo(
    @Param('id') deviceId: string
  ) {
    const semaforo = await this.semaforoService.unLinkSemaforo(
      deviceId,
    );
    return semaforo;
  }
}
