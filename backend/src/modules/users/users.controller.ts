import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateRoleDto, CreateUserDto, UpdateRoleDto, UpdateUserDto } from './users.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Users & Roles')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermission('users', 'read')
  findAll(@CurrentUser('companyId') companyId: string, @Query() dto: PaginationDto) {
    return this.users.findAll(companyId, dto);
  }

  @Post()
  @RequirePermission('users', 'create')
  create(@CurrentUser('companyId') companyId: string, @Body() dto: CreateUserDto) {
    return this.users.create(companyId, dto);
  }

  @Patch(':id')
  @RequirePermission('users', 'update')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(companyId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('users', 'delete')
  remove(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('id') requesterId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.users.remove(companyId, id, requesterId);
  }

  @Get('roles/all')
  @RequirePermission('roles', 'read')
  listRoles() {
    return this.users.listRoles();
  }

  @Get('permissions/all')
  @RequirePermission('roles', 'read')
  listPermissions() {
    return this.users.listPermissions();
  }

  @Post('roles')
  @RequirePermission('roles', 'create')
  createRole(@Body() dto: CreateRoleDto) {
    return this.users.createRole(dto);
  }

  @Patch('roles/:id')
  @RequirePermission('roles', 'update')
  updateRole(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto) {
    return this.users.updateRole(id, dto);
  }

  @Delete('roles/:id')
  @RequirePermission('roles', 'delete')
  removeRole(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.removeRole(id);
  }
}
