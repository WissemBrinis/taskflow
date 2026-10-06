import {
  Body, Controller, Delete, HttpCode, Param,
  ParseUUIDPipe, Patch, Post, UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import * as jwtAuthGuard from '../auth/jwt-auth.guard.js';
import { ColumnsService } from './columns.service.js';
import { CreateColumnDto } from './dto/create-column.dto.js';
import { UpdateColumnDto } from './dto/update-column.dto.js';

@UseGuards(jwtAuthGuard.JwtAuthGuard)
@Controller()
export class ColumnsController {
  constructor(private columns: ColumnsService) {}

  @Post('boards/:boardId/columns')
  create(
    @CurrentUser() user: jwtAuthGuard.JwtPayload,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Body() dto: CreateColumnDto,
  ) {
    return this.columns.create(user.sub, boardId, dto);
  }

  @Patch('columns/:id')
  update(
    @CurrentUser() user: jwtAuthGuard.JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateColumnDto,
  ) {
    return this.columns.update(user.sub, id, dto);
  }

  @Delete('columns/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: jwtAuthGuard.JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.columns.remove(user.sub, id);
  }
}