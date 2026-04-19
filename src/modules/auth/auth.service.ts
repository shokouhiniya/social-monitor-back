import { Injectable, UnauthorizedException } from '@nestjs/common';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthInterface } from './auth.interface';

// Simple hardcoded user for now
const VALID_USER = {
  username: 'sajjad',
  password: 'sajjad123456',
  name: 'سجاد',
};

@Injectable()
export class AuthService {
  login(loginDto: LoginDto): { token: string; user: { username: string; name: string } } {
    const { username, password } = loginDto;

    // Simple validation
    if (username === VALID_USER.username && password === VALID_USER.password) {
      // Generate a simple token (in production, use JWT)
      const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');
      return {
        token,
        user: {
          username: VALID_USER.username,
          name: VALID_USER.name,
        },
      };
    }

    throw new UnauthorizedException('نام کاربری یا رمز عبور اشتباه است');
  }

  generateToken(entity: AuthInterface) {
    console.log(entity);
  }

  register(registerDto: RegisterDto): string {
    console.log(registerDto);

    return 'register';
  }

  validateToken(token: string): boolean {
    // Simple token validation (in production, use JWT verification)
    try {
      const decoded = Buffer.from(token, 'base64').toString();
      return decoded.startsWith(VALID_USER.username);
    } catch {
      return false;
    }
  }
}
