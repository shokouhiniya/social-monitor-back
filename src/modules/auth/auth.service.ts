import { Injectable } from '@nestjs/common';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthInterface } from './auth.interface';

@Injectable()
export class AuthService {
  login(loginDto: LoginDto): string {
    console.log(loginDto);

    return 'Login';
  }

  generateToken(entity: AuthInterface) {
    console.log(entity);
  }

  register(registerDto: RegisterDto): string {
    console.log(registerDto);

    return 'register';
  }
}
