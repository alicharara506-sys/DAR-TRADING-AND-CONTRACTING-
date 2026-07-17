import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import {
  AddMemberDto, CreateMilestoneDto, CreateProjectDto, QueryProjectsDto,
  UpdateMilestoneDto, UpdateProjectDto,
} from './projects.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @RequirePermission('projects', 'read')
  findAll(@CurrentUser('companyId') companyId: string, @Query() dto: QueryProjectsDto) {
    return this.projects.findAll(companyId, dto);
  }

  @Get(':id')
  @RequirePermission('projects', 'read')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.findOne(companyId, id);
  }

  @Post()
  @RequirePermission('projects', 'create')
  create(@CurrentUser('companyId') companyId: string, @Body() dto: CreateProjectDto) {
    return this.projects.create(companyId, dto);
  }

  @Patch(':id')
  @RequirePermission('projects', 'update')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.update(companyId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('projects', 'delete')
  remove(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.remove(companyId, id);
  }

  @Post(':id/recompute-progress')
  @RequirePermission('projects', 'update')
  recompute(@Param('id', ParseUUIDPipe) id: string) {
    return this.projects.recomputeProgress(id);
  }

  // Milestones
  @Get(':id/milestones')
  @RequirePermission('projects', 'read')
  listMilestones(@Param('id', ParseUUIDPipe) id: string) {
    return this.projects.listMilestones(id);
  }

  @Post(':id/milestones')
  @RequirePermission('projects', 'update')
  createMilestone(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateMilestoneDto) {
    return this.projects.createMilestone(id, dto);
  }

  @Patch('milestones/:milestoneId')
  @RequirePermission('projects', 'update')
  updateMilestone(@Param('milestoneId', ParseUUIDPipe) milestoneId: string, @Body() dto: UpdateMilestoneDto) {
    return this.projects.updateMilestone(milestoneId, dto);
  }

  @Delete('milestones/:milestoneId')
  @RequirePermission('projects', 'update')
  removeMilestone(@Param('milestoneId', ParseUUIDPipe) milestoneId: string) {
    return this.projects.removeMilestone(milestoneId);
  }

  // Members
  @Post(':id/members')
  @RequirePermission('projects', 'update')
  addMember(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddMemberDto) {
    return this.projects.addMember(id, dto);
  }

  @Delete(':id/members/:userId')
  @RequirePermission('projects', 'update')
  removeMember(@Param('id', ParseUUIDPipe) id: string, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.projects.removeMember(id, userId);
  }
}
