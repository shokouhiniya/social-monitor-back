import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiConfig } from './entities/api-config.entity';
import { CryptoService } from '../../libs/crypto/crypto.service';
import {
  HetznerServer,
  HetznerServersResponse,
  HetznerServerResponse,
  HetznerActionResponse,
  HetznerErrorResponse,
} from './interfaces/hetzner-api.interface';

@Injectable()
export class HetznerService {
  private readonly logger = new Logger(HetznerService.name);
  private readonly baseUrl: string;
  private axiosInstance: AxiosInstance;

  constructor(
    @InjectRepository(ApiConfig)
    private apiConfigRepository: Repository<ApiConfig>,
    private cryptoService: CryptoService,
    private configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.get<string>('HETZNER_API_BASE_URL') ||
      'https://api.hetzner.cloud/v1';
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private async getApiToken(): Promise<string> {
    const config = await this.apiConfigRepository.findOne({
      where: { key: 'hetzner_api_token' },
    });

    if (!config) {
      throw new HttpException(
        'Hetzner API token not configured',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.cryptoService.decrypt(config.value);
  }

  private async makeRequest<T>(
    method: 'get' | 'post' | 'put' | 'delete',
    endpoint: string,
    data?: any,
  ): Promise<T> {
    try {
      const token = await this.getApiToken();
      const response = await this.axiosInstance.request<T>({
        method,
        url: endpoint,
        data,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data;
    } catch (error) {
      this.handleHetznerError(error);
    }
  }

  private handleHetznerError(error: any): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<HetznerErrorResponse>;

      if (axiosError.response) {
        const status = axiosError.response.status;
        const errorData = axiosError.response.data;

        this.logger.error(
          `Hetzner API error: ${status} - ${JSON.stringify(errorData)}`,
        );

        if (status === 401) {
          throw new HttpException(
            'Invalid Hetzner API token',
            HttpStatus.UNAUTHORIZED,
          );
        } else if (status === 404) {
          throw new HttpException(
            'Server not found',
            HttpStatus.NOT_FOUND,
          );
        } else if (status === 429) {
          throw new HttpException(
            'Rate limit exceeded. Please try again later',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        } else if (status >= 500) {
          throw new HttpException(
            'Hetzner Cloud service unavailable',
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }

        throw new HttpException(
          errorData?.error?.message || 'Hetzner API request failed',
          status,
        );
      } else if (axiosError.request) {
        this.logger.error('No response from Hetzner API');
        throw new HttpException(
          'Unable to reach Hetzner Cloud API',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    }

    this.logger.error(`Unexpected error: ${error.message}`);
    throw new HttpException(
      'An unexpected error occurred',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  async getServers(): Promise<HetznerServer[]> {
    const response = await this.makeRequest<HetznerServersResponse>(
      'get',
      '/servers',
    );
    return response.servers;
  }

  async getServer(serverId: string): Promise<HetznerServer> {
    const response = await this.makeRequest<HetznerServerResponse>(
      'get',
      `/servers/${serverId}`,
    );
    return response.server;
  }

  async powerOnServer(serverId: string): Promise<HetznerActionResponse> {
    return await this.makeRequest<HetznerActionResponse>(
      'post',
      `/servers/${serverId}/actions/poweron`,
    );
  }

  async powerOffServer(serverId: string): Promise<HetznerActionResponse> {
    return await this.makeRequest<HetznerActionResponse>(
      'post',
      `/servers/${serverId}/actions/poweroff`,
    );
  }

  async rebootServer(serverId: string): Promise<HetznerActionResponse> {
    return await this.makeRequest<HetznerActionResponse>(
      'post',
      `/servers/${serverId}/actions/reboot`,
    );
  }

  async validateApiToken(token: string): Promise<boolean> {
    try {
      const testInstance = axios.create({
        baseURL: this.baseUrl,
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      await testInstance.get('/servers');
      return true;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        return false;
      }
      throw error;
    }
  }
}
