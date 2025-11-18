import { SemaforoDto } from './semaforo.dto';
export class SemaforoInfoDto {
  semaforo: SemaforoDto;      
  nodes?: any | null;          
  ways?: any | null;           
  packs?: any | null;         
}
