import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UserPermissions } from './entities/user-permissions.entity';
import { userCreateDto } from './user.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserPermissions)
    private userPermissionsRepository: Repository<UserPermissions>,
  ) {}

  async getAll() {
    return await this.userRepository.find({
      select: ['id', 'name', 'email', 'phone', 'role', 'is_active'],
    });
  }

  async getById(id: number) {
    return await this.userRepository.findOne({
      where: { id },
    });
  }

  async getByPhoneNumber(phone: string) {
    return await this.userRepository.find({
      where: { phone },
    });
  }

  async create(data: userCreateDto) {
    // Create a new user
    const { phone } = data;

    if ((await this.getByPhoneNumber(phone)) !== null) {
      throw new HttpException('User exists', 400);
    }

    const user = this.userRepository.create(data);

    // Save the user to the database
    const savedUser = await this.userRepository.save(user);

    // Create default permissions for the new user
    const permissions = this.userPermissionsRepository.create({
      userId: savedUser.id,
      canManagePower: true,
      canAccessConsole: true,
      canViewMetrics: true,
      canViewDetails: true,
    });
    await this.userPermissionsRepository.save(permissions);

    return savedUser;
  }

  async getAllWithAssignmentCounts() {
    const users = await this.userRepository
      .createQueryBuilder('user')
      .leftJoin('server_assignments', 'sa', 'sa.user_id = user.id')
      .select([
        'user.id',
        'user.name',
        'user.email',
        'user.role',
        'user.created_at',
        'COUNT(sa.id) as assignedServersCount',
      ])
      .groupBy('user.id')
      .addGroupBy('user.name')
      .addGroupBy('user.email')
      .addGroupBy('user.role')
      .addGroupBy('user.created_at')
      .getRawMany();

    return users.map((user) => ({
      id: user.user_id,
      name: user.user_name,
      email: user.user_email,
      role: user.user_role,
      createdAt: user.user_created_at,
      assignedServersCount: parseInt(user.assignedserverscount) || 0,
    }));
  }

  async getUserByIdWithPermissions(userId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new HttpException('User not found', 404);
    }

    let permissions = await this.userPermissionsRepository.findOne({
      where: { userId },
    });

    // Create default permissions if they don't exist
    if (!permissions) {
      permissions = this.userPermissionsRepository.create({
        userId,
        canManagePower: true,
        canAccessConsole: true,
        canViewMetrics: true,
        canViewDetails: true,
      });
      await this.userPermissionsRepository.save(permissions);
    }

    // Get assigned servers count
    const assignedServersCount = await this.userRepository
      .createQueryBuilder('user')
      .leftJoin('server_assignments', 'sa', 'sa.user_id = user.id')
      .where('user.id = :userId', { userId })
      .select('COUNT(sa.id)', 'count')
      .getRawOne();

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.created_at,
      permissions: {
        canManagePower: permissions.canManagePower,
        canAccessConsole: permissions.canAccessConsole,
        canViewMetrics: permissions.canViewMetrics,
        canViewDetails: permissions.canViewDetails,
      },
      assignedServersCount: parseInt(assignedServersCount.count) || 0,
    };
  }

  async updatePermissions(userId: number, permissionsDto: UpdatePermissionsDto) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new HttpException('User not found', 404);
    }

    let permissions = await this.userPermissionsRepository.findOne({
      where: { userId },
    });

    if (!permissions) {
      // Create permissions if they don't exist
      permissions = this.userPermissionsRepository.create({
        userId,
        ...permissionsDto,
      });
    } else {
      // Update existing permissions
      Object.assign(permissions, permissionsDto);
    }

    return await this.userPermissionsRepository.save(permissions);
  }

  async getUserPermissions(userId: number) {
    let permissions = await this.userPermissionsRepository.findOne({
      where: { userId },
    });

    // Create default permissions if they don't exist
    if (!permissions) {
      permissions = this.userPermissionsRepository.create({
        userId,
        canManagePower: true,
        canAccessConsole: true,
        canViewMetrics: true,
        canViewDetails: true,
      });
      await this.userPermissionsRepository.save(permissions);
    }

    return permissions;
  }

  async hasPermission(userId: number, permission: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);

    switch (permission) {
      case 'canManagePower':
        return permissions.canManagePower;
      case 'canAccessConsole':
        return permissions.canAccessConsole;
      case 'canViewMetrics':
        return permissions.canViewMetrics;
      case 'canViewDetails':
        return permissions.canViewDetails;
      default:
        return false;
    }
  }
}
