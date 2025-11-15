import { PackDto } from '@dtos/pack/pack.dto';
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
    return this.packService.getPack(id);
  }

  @Post()
  create(@Body() body: PackDto) {
    console.log(body);
    return this.packService.createPack(body);
  }

  // @Put(':id')
  // update(
  //   @Param('id') id: string,
  //   @Body() body: { node?: string; semaforos?: number[] },
  // ) {
  //   return this.packService.updatePack(Number(id), body.node, body.semaforos);
  // }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.packService.deletePack(id);
  }

}
