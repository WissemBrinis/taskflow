import {
  Body, Controller, Delete, Get, HttpCode, Param,
  ParseUUIDPipe, Patch, Post, UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import * as jwtAuthGuard from '../auth/jwt-auth.guard.js';
import { BoardsService } from './boards.service.js';
import { CreateBoardDto } from './dto/create-board.dto.js';
import { UpdateBoardDto } from './dto/update-board.dto.js';

@UseGuards(jwtAuthGuard.JwtAuthGuard)
@Controller('boards')
export class BoardsController {
  constructor(private boards: BoardsService) {}

  @Post()
  create(@CurrentUser() user: jwtAuthGuard.JwtPayload, @Body() dto: CreateBoardDto) {
    return this.boards.create(user.sub, dto);
  }

  @Get()
  findAll(@CurrentUser() user: jwtAuthGuard.JwtPayload) {
    return this.boards.findAll(user.sub);
  }

  @Get(':id')
  findOne(@CurrentUser() user: jwtAuthGuard.JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.boards.findOne(user.sub, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: jwtAuthGuard.JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBoardDto,
  ) {
    return this.boards.update(user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: jwtAuthGuard.JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.boards.remove(user.sub, id);
  }
}