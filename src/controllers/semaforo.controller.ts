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
} from '@nestjs/common';
import { SemaforoDto } from '@dtos/semaforos/semaforo.dto';
import { SemaforoService } from 'src/services/semaforo.service';

@Controller('semaforo')
export class SemaforoController {
  constructor(private readonly semaforoService: SemaforoService) {}

  @Get()
  @Version('1')
  getAll(@Query() filters: SemaforoFilters) {
    console.log(filters);
    return this.semaforoService.getAllSemaforos(filters);
  }

  @Get(':id')
  @Version('1')
  getOne(@Param('id') id: string) {
    return this.semaforoService.getSemaforo(Number(id));
  }

  @Post()
  @Version('1')
  create(@Body() body: { macAddress: string; deviceId: string; ip: string }) {
    return this.semaforoService.createSemaforo(
      body.macAddress,
      body.deviceId,
      body.ip,
    );
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
}
