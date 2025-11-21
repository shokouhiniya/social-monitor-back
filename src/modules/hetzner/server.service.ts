import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServerAssignment } from './entities/server-assignment.entity';
import { ApiConfig } from './entities/api-config.entity';
import { HetznerService } from './hetzner.service';
import { CryptoService } from '../../libs/crypto/crypto.service';
import { HetznerServer } from './interfaces/hetzner-api.interface';

export interface ServerWithAssignment extends HetznerServer {
  assignedUser?: {
    id: number;
    name: string;
    phone: string;
  };
  isAssigned: boolean;
}

@Injectable()
export class ServerService {
  private readonly logger = new Logger(ServerService.name);

  constructor(
    @InjectRepository(ServerAssignment)
    private serverAssignmentRepository: Repository<ServerAssignment>,
    @InjectRepository(ApiConfig)
    private apiConfigRepository: Repository<ApiConfig>,
    private hetznerService: HetznerService,
    private cryptoService: CryptoService,
  ) {}

  async getAllServersWithAssignments(): Promise<ServerWithAssignment[]> {
    const servers = await this.hetznerService.getServers();
    const assignments = await this.serverAssignmentRepository.find({
      relations: ['user'],
    });

    const assignmentMap = new Map(
      assignments.map((a) => [a.server_id, a]),
    );

    return servers.map((server) => {
      const assignment = assignmentMap.get(server.id.toString());
      return {
        ...server,
        isAssigned: !!assignment,
        assignedUser: assignment
          ? {
              id: assignment.user.id,
              name: assignment.user.name,
              phone: assignment.user.phone,
            }
          : undefined,
      };
    });
  }

  async getUserServers(userId: number): Promise<HetznerServer[]> {
    const assignments = await this.serverAssignmentRepository.find({
      where: { user_id: userId },
    });

    if (assignments.length === 0) {
      return [];
    }

    const servers = await this.hetznerService.getServers();
    const assignedServerIds = new Set(
      assignments.map((a) => a.server_id),
    );

    return servers.filter((server) =>
      assignedServerIds.has(server.id.toString()),
    );
  }

  async assignServer(
    serverId: string,
    userId: number,
  ): Promise<ServerAssignment> {
    // Check if server exists in Hetzner
    try {
      await this.hetznerService.getServer(serverId);
    } catch (error) {
      throw new HttpException(
        'Server not found in Hetzner Cloud',
        HttpStatus.NOT_FOUND,
      );
    }

    // Check if server is already assigned
    const existingAssignment = await this.serverAssignmentRepository.findOne({
      where: { server_id: serverId },
    });

    if (existingAssignment) {
      throw new HttpException(
        'Server is already assigned to another user',
        HttpStatus.CONFLICT,
      );
    }

    // Create new assignment
    const assignment = this.serverAssignmentRepository.create({
      server_id: serverId,
      user_id: userId,
    });

    return await this.serverAssignmentRepository.save(assignment);
  }

  async unassignServer(serverId: string): Promise<void> {
    const assignment = await this.serverAssignmentRepository.findOne({
      where: { server_id: serverId },
    });

    if (!assignment) {
      throw new HttpException(
        'Server assignment not found',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.serverAssignmentRepository.remove(assignment);
  }

  async hasServerAccess(userId: number, serverId: string): Promise<boolean> {
    const assignment = await this.serverAssignmentRepository.findOne({
      where: {
        user_id: userId,
        server_id: serverId,
      },
    });

    return !!assignment;
  }

  async saveApiToken(token: string): Promise<void> {
    // Validate token first
    const isValid = await this.hetznerService.validateApiToken(token);
    if (!isValid) {
      throw new HttpException(
        'Invalid Hetzner API token',
        HttpStatus.BAD_REQUEST,
      );
    }

    const encryptedToken = this.cryptoService.encrypt(token);

    let config = await this.apiConfigRepository.findOne({
      where: { key: 'hetzner_api_token' },
    });

    if (config) {
      config.value = encryptedToken;
    } else {
      config = this.apiConfigRepository.create({
        key: 'hetzner_api_token',
        value: encryptedToken,
      });
    }

    await this.apiConfigRepository.save(config);
  }

  async getApiToken(): Promise<{ token: string; masked: string } | null> {
    const config = await this.apiConfigRepository.findOne({
      where: { key: 'hetzner_api_token' },
    });

    if (!config) {
      return null;
    }

    const decryptedToken = this.cryptoService.decrypt(config.value);
    const maskedToken = this.cryptoService.maskToken(decryptedToken);

    return {
      token: decryptedToken,
      masked: maskedToken,
    };
  }
}
