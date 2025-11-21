import { Module, forwardRef } from '@nestjs/common';
import { UserController } from './user.controller';
import { AdminUserController } from './controllers/admin-user.controller';
import { UserService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UserPermissions } from './entities/user-permissions.entity';
import { AuthModule } from '../auth/auth.module';
import { HetznerModule } from '../hetzner/hetzner.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserPermissions]),
    forwardRef(() => AuthModule),
    forwardRef(() => HetznerModule),
  ],
  controllers: [UserController, AdminUserController],
  providers: [UserService],
  exports: [UserService, TypeOrmModule],
})
export class UserModule {}
