import { SemafotoFilters } from '@dtos/semaforos/semaforo-filters.dto';
import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { SemafotoDto } from 'src/dto/semaforo.dto';
import { SemaforoService } from 'src/services/semaforo.service';


@Controller('semaforo')
export class SemaforoController {
  constructor(private readonly semaforoService: SemaforoService) {}

  @Get()
  getAll(@Query() filters: SemafotoFilters) {
    return this.semaforoService.getAllSemaforos(filters);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.semaforoService.getSemaforo(Number(id));
  }

  @Post()
  create(@Body() body: { macAddress: string; deviceId: string, ip: string }) {
    return this.semaforoService.createSemaforo(body.macAddress, body.deviceId, body.ip);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: Partial<SemafotoDto>,
  ) {
    return this.semaforoService.updateSemaforo(Number(id), body);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.semaforoService.deleteSemaforo(Number(id));
  }

}
