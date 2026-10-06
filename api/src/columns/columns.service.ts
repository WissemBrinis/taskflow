import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateColumnDto } from './dto/create-column.dto.js';
import { UpdateColumnDto } from './dto/update-column.dto.js';

@Injectable()
export class ColumnsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, boardId: string, dto: CreateColumnDto) {
    const board = await this.prisma.board.findFirst({
      where: { id: boardId, ownerId: userId },
      select: { id: true },
    });
    if (!board) throw new NotFoundException('Board not found');

    const last = await this.prisma.column.aggregate({
      where: { boardId },
      _max: { position: true },
    });
    return this.prisma.column.create({
      data: { title: dto.title, boardId, position: (last._max.position ?? -1) + 1 },
    });
  }

  async update(userId: string, id: string, dto: UpdateColumnDto) {
    await this.assertOwned(userId, id);
    return this.prisma.column.update({
      where: { id },
      data: { title: dto.title, position: dto.position },
    });
  }

  async remove(userId: string, id: string) {
    await this.assertOwned(userId, id);
    await this.prisma.column.delete({ where: { id } });
  }

  private async assertOwned(userId: string, id: string) {
    const column = await this.prisma.column.findFirst({
      where: { id, board: { ownerId: userId } },
      select: { id: true },
    });
    if (!column) throw new NotFoundException('Column not found');
  }
}