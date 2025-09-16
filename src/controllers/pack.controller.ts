import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { PackService } from 'src/services/pack.service';


@Controller('pack')
export class PackController {
  constructor(private readonly packService: PackService) {}

  @Get()
  getAll() {
    return this.packService.getAllPacks();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.packService.getPack(Number(id));
  }

  @Post()
  create(@Body() body: { macAddress: string; semaforosIds: number[],  packsIds: number[],}) {
    return this.packService.createPack(body.macAddress, body.semaforosIds, body.packsIds);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: { node?: string; semaforos?: number[] },
  ) {
    return this.packService.updatePack(Number(id), body.node, body.semaforos);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.packService.deletePack(Number(id));

  }

  @Get("subpack")
  getAllSubPacks() {
    return this.packService.getAllPacks();
  }

  // ----SubPacks----

  @Get('subpack/:id')
  getOneSubPack(@Param('id') id: string) {
    return this.packService.getSubPack(Number(id));
  }

  @Post("subpack")
  createSubPack(@Body() body: { packId: number; semaforosIds: [] }) {
    return this.packService.createSubPack(body.semaforosIds, body.packId);
  }

  @Put('subpack/:id')
  updateSubPack(
    @Param('id') id: string,
    @Body() body: { node?: string; semaforos?: number[] },
  ) {
    return this.packService.updateSubPack(Number(id), body.node, body.semaforos);
  }

  @Delete('subpack/:id')
  deleteSubPacks(@Param('id') id: string) {
    return this.packService.deleteSubPack(Number(id));
  }

}
