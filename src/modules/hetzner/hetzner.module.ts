import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { HetznerService } from './hetzner.service';
import { ServerService } from './server.service';
import { AdminServerController } from './controllers/admin-server.controller';
import { UserServerController } from './controllers/user-server.controller';
import { ApiConfig } from './entities/api-config.entity';
import { ServerAssignment } from './entities/server-assignment.entity';
import { CryptoModule } from '../../libs/crypto/crypto.module';
import { ConfigModule } from '../../libs/config/config.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiConfig, ServerAssignment]),
    CryptoModule,
    ConfigModule,
    forwardRef(() => UserModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret') || 'secretKey',
        signOptions: {
          expiresIn: (configService.get<string>('jwt.expiresIn') || '60m') as any,
        },
      }),
    }),
  ],
  controllers: [AdminServerController, UserServerController],
  providers: [HetznerService, ServerService],
  exports: [HetznerService, ServerService],
})
export class HetznerModule {}
