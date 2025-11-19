import { Injectable } from '@nestjs/common';

@Injectable()
export class WebSocketService {
  // Map: semaforoId -> set de socketIds
  private listeners: Map<string, Set<string>> = new Map();

  // Adiciona um socket interessado em um semáforo
  async addListener(semaforoId: string, socketId: string) {
    if (!this.listeners.has(semaforoId)) {
      this.listeners.set(semaforoId, new Set());
    }
    this.listeners.get(semaforoId)!.add(socketId);
  }

  // Remove socket do semáforo
  async removeListener(semaforoId: string, socketId: string) {
    this.listeners.get(semaforoId)?.delete(socketId);
  }

  // Retorna todos os sockets interessados em um semáforo
  async getListeners(semaforoId: string): Promise<Set<string>> {
    return this.listeners.get(semaforoId) || new Set();
  }
  

  async removeSocketFromAll(socketId: string) {
    this.listeners.forEach((set) => set.delete(socketId));
  }

  // retornar todos os semáforos sendo ouvidos
  async getAllSemaforos(): Promise<string[]> {
    return Array.from(this.listeners.keys());
  }
}
