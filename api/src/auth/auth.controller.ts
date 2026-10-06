import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import * as jwtAuthGuard from './jwt-auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @UseGuards(jwtAuthGuard.JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: jwtAuthGuard.JwtPayload) {
    return { id: user.sub, email: user.email };
  }
}