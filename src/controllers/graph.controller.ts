import {
  Controller,
  Get,
  Query,
  Res,
  HttpStatus,
  Post,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Parser as Json2CsvParser } from 'json2csv';
import { diskStorage } from 'multer';
import { GraphService } from 'src/services/graph.service';

@Controller('graph')
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

  // Export full graph as JSON (brotli/gzip behind reverse proxy recommended)
  @Get('export/json')
  async exportJson(@Res() res: Response) {
    try {
      const data = await this.graphService.exportFullGraph();
      return res.status(HttpStatus.OK).json(data);
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: 'Erro exportando grafo', error: err.message });
    }
  }

  // Paginated nodes + relationships (saída JSON)
  @Get('export/paged')
  async exportPaged(
    @Query('skip') skip: string,
    @Query('limit') limit: string,
    @Res() res: Response,
  ) {
    const s = Math.max(Number(skip) || 0, 0);
    const l = Math.max(Math.min(Number(limit) || 100, 1000), 1); // cap
    try {
      const data = await this.graphService.exportNodesPaged(s, l);
      return res.status(HttpStatus.OK).json({ skip: s, limit: l, ...data });
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        message: 'Erro exportando grafo paginado',
        error: err.message,
      });
    }
  }

  // Stream CSV: nodes and relationships (simple approach)
  @Get('export/csv')
  async exportCsv(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=graph.csv');

    // Colunas simples: kind,nodeId,labels,propKey1,propKey2,... or relation rows
    // Aqui faremos: first lines -> nodes, then an empty line, then relationships.
    try {
      // 1) nodes
      const full = await this.graphService.exportFullGraph(); // para grafos muito grandes trocar por streaming
      // Emit nodes
      const nodeRows = full.nodes.map((n) => {
        const p =
          typeof n.properties === 'object' ? JSON.stringify(n.properties) : '';
        return {
          kind: 'node',
          id: n.id,
          labels: (n.labels || []).join('|'),
          properties: p,
        };
      });
      const relRows = full.relationships.map((r) => ({
        kind: 'relationship',
        id: r.id,
        type: r.type,
        start: r.startNodeId,
        end: r.endNodeId,
        properties: JSON.stringify(r.properties || {}),
      }));

      const allRows = [...nodeRows, ...relRows];
      const fields = Object.keys(allRows[0] || { kind: '', id: '' });
      const parser = new Json2CsvParser({ fields });
      const csv = parser.parse(allRows);
      res.send(csv);
    } catch (err) {
      console.error(err);
      res.status(500).send('Erro gerando CSV: ' + err.message);
    }
  }

  @Post('upload/osm')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads', // cria pasta uploads
        filename: (req, file, cb) => cb(null, file.originalname),
      }),
    }),
  )
  async uploadOsm(@UploadedFile() file: Express.Multer.File) {
    return this.graphService.importFromFile(file.path);
  }

  @Post('upload/json')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads', // cria pasta uploads
        filename: (req, file, cb) => cb(null, file.originalname),
      }),
    }),
  )
  async uploadJson(@UploadedFile() file: Express.Multer.File) {
    return this.graphService.importFromJson(file.path);
  }
}
