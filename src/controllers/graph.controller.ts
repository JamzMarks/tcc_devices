import { DeviceDto, DeviceGraphDto } from '@dtos/device.dto';
import { SemaforoDto } from '@dtos/semaforos/semaforo.dto';
import {
  Controller,
  Get,
  Query,
  Res,
  HttpStatus,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  Param,
  Version,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { diskStorage } from 'multer';
import { GraphService } from 'src/services/graph.service';

@Controller('graph')
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

   @Get('full-graph')
  async exportGraph(@Res() res: Response) {
    try {
      const data = await this.graphService.exportGraphForBuild();
      return res.status(HttpStatus.OK).json(data);
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: 'Erro exportando grafo', error: err.message });
    }
  }

  @Get('full-graph2')
  async exportGraph2(@Res() res: Response) {
    try {
      const data = await this.graphService.exportGraphForBuild2();
      return res.status(HttpStatus.OK).json(data);
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: 'Erro exportando grafo', error: err.message });
    }
  }

  @Post('clear/:wayId')
  async clearWayNodes(@Param('wayId') wayId: string, @Res() res: Response){
    try {
      await this.graphService.clearWayNodes(wayId);
      const message = 'ok'
      return res.status(HttpStatus.OK).json(message);
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: 'Erro limpando o grafo', error: err.message });
    }
  }


  @Post('upload/json')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => cb(null, file.originalname),
      }),
    }),
  )
  async uploadJson(@UploadedFile() file: Express.Multer.File) {
    return this.graphService.importFromJson(file.path);
  }

  @Get('ways')
  async getNodeWays(@Res() res: Response) {
    try {
      const data = await this.graphService.getWays();
      return res.status(HttpStatus.OK).json(data);
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: 'Erro exportando grafo', error: err.message });
    }
  }

  @Post('ways/common/nodes')
  async getWaysCommonNode(
    @Body() dto: { way1: string; way2: string },
    @Res() res: Response,
  ) {
    try {
      const data = await this.graphService.getCommonNodesBetweenWays(
        dto.way1,
        dto.way2,
      );
      return res.status(HttpStatus.OK).json(data);
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: 'Erro exportando grafo', error: err.message });
    }
  }
  @Get('nodes/:id')
  async getNodeById(@Param('id') id: string, @Res() res: Response) {
    try {
      const data = await this.graphService.getNodeById(id);
      return res.status(HttpStatus.OK).json(data);
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: 'Erro exportando grafo', error: err.message });
    }
  }

  @Post('devices')
  async createDevice(@Body() body: {
    deviceData: DeviceGraphDto, 
    wayId: string,
    node1: string,
    node2: string
  }, @Res() res: Response) {
    try {
      console.log(body)
      const data = await this.graphService.createDevice(body.node1, body.node2, body.wayId, body.deviceData);
      return res.status(HttpStatus.OK).json(data);
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: 'Erro exportando grafo', error: err.message });
    }
  }
  
  @Get(':id/siblings')
  @Version('1')
  async siblings(@Param('id') id: string, @Res() res: Response) {
    try {
      const data = await this.graphService.getSiblings(id);
      return res.status(HttpStatus.OK).json(data);
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: 'Erro exportando grafo', error: err.message });
    }
  }
  
}
