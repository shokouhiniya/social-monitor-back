import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('login')
  login(@Query() loginDto: LoginDto): string {
    return this.authService.login(loginDto);
  }

  @Post('register')
  register(@Body() register: RegisterDto): string {
    return this.authService.register(register);
  }
}
