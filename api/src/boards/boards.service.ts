import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateBoardDto } from './dto/create-board.dto.js';
import { UpdateBoardDto } from './dto/update-board.dto.js';

const DEFAULT_COLUMNS = ['To Do', 'Doing', 'Done'];

@Injectable()
export class BoardsService {
  constructor(private prisma: PrismaService) {}

  create(userId: string, dto: CreateBoardDto) {
    return this.prisma.board.create({
      data: {
        title: dto.title,
        ownerId: userId,
        columns: {
          create: DEFAULT_COLUMNS.map((title, position) => ({ title, position })),
        },
      },
      include: { columns: { orderBy: { position: 'asc' } } },
    });
  }

  findAll(userId: string) {
    return this.prisma.board.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const board = await this.prisma.board.findFirst({
      where: { id, ownerId: userId },
      include: {
        columns: {
          orderBy: { position: 'asc' },
          include: { tasks: { orderBy: { position: 'asc' } } },
        },
      },
    });
    if (!board) throw new NotFoundException('Board not found');
    return board;
  }

  async update(userId: string, id: string, dto: UpdateBoardDto) {
    await this.assertOwned(userId, id);
    return this.prisma.board.update({ where: { id }, data: { title: dto.title } });
  }

  async remove(userId: string, id: string) {
    await this.assertOwned(userId, id);
    await this.prisma.board.delete({ where: { id } });
  }

  private async assertOwned(userId: string, id: string) {
    const board = await this.prisma.board.findFirst({
      where: { id, ownerId: userId },
      select: { id: true },
    });
    if (!board) throw new NotFoundException('Board not found');
  }
}