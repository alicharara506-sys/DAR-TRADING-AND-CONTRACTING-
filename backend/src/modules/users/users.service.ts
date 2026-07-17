import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDto, paginate, pageArgs } from '../../common/dto/pagination.dto';
import { CreateRoleDto, CreateUserDto, UpdateRoleDto, UpdateUserDto } from './users.dto';

const USER_SAFE = {
  id: true, email: true, firstName: true, lastName: true, phone: true, avatarUrl: true,
  locale: true, timezone: true, status: true, roleId: true, lastLoginAt: true, createdAt: true,
  role: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string, dto: PaginationDto) {
    const where: Prisma.UserWhereInput = {
      companyId,
      ...(dto.search && {
        OR: [
          { email: { contains: dto.search, mode: 'insensitive' } },
          { firstName: { contains: dto.search, mode: 'insensitive' } },
          { lastName: { contains: dto.search, mode: 'insensitive' } },
        ],
      }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where, select: USER_SAFE, ...pageArgs(dto),
        orderBy: { [dto.sortBy ?? 'createdAt']: dto.sortOrder ?? 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(data, total, dto);
  }

  async create(companyId: string, dto: CreateUserDto) {
    const { password, ...rest } = dto;
    return this.prisma.user.create({
      data: {
        ...rest,
        email: dto.email.toLowerCase(),
        companyId,
        passwordHash: await bcrypt.hash(password, 12),
      },
      select: USER_SAFE,
    });
  }

  async update(companyId: string, id: string, dto: UpdateUserDto) {
    const { password, ...rest } = dto;
    const data: Prisma.UserUpdateInput = { ...rest };
    if (password) data.passwordHash = await bcrypt.hash(password, 12);
    if (rest.email) data.email = rest.email.toLowerCase();
    const user = await this.prisma.user.findFirst({ where: { id, companyId } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({ where: { id }, data, select: USER_SAFE });
  }

  async remove(companyId: string, id: string, requesterId: string) {
    if (id === requesterId) throw new BadRequestException('Cannot delete your own account');
    const user = await this.prisma.user.findFirst({ where: { id, companyId } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.prisma.refreshToken.updateMany({ where: { userId: id }, data: { revokedAt: new Date() } });
    return { success: true };
  }

  // ---- Roles & permissions ----
  listRoles() {
    return this.prisma.role.findMany({
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
      orderBy: { name: 'asc' },
    });
  }

  listPermissions() {
    return this.prisma.permission.findMany({ orderBy: [{ resource: 'asc' }, { action: 'asc' }] });
  }

  async createRole(dto: CreateRoleDto) {
    return this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        permissions: dto.permissionIds
          ? { create: dto.permissionIds.map((permissionId) => ({ permissionId })) }
          : undefined,
      },
      include: { permissions: { include: { permission: true } } },
    });
  }

  async updateRole(id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findUniqueOrThrow({ where: { id } });
    if (role.isSystem && dto.name && dto.name !== role.name) {
      throw new BadRequestException('System role cannot be renamed');
    }
    return this.prisma.$transaction(async (tx) => {
      if (dto.permissionIds) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        await tx.rolePermission.createMany({
          data: dto.permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
        });
      }
      return tx.role.update({
        where: { id },
        data: { name: dto.name, description: dto.description },
        include: { permissions: { include: { permission: true } } },
      });
    });
  }

  async removeRole(id: string) {
    const role = await this.prisma.role.findUniqueOrThrow({
      where: { id }, include: { _count: { select: { users: true } } },
    });
    if (role.isSystem) throw new BadRequestException('System role cannot be deleted');
    if (role._count.users > 0) throw new BadRequestException('Role has assigned users');
    await this.prisma.role.delete({ where: { id } });
    return { success: true };
  }
}
