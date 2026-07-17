import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';
import { SchedulingService } from './scheduling.service';
import {
  CreateDependencyDto, CreateTaskDto, CreateWbsNodeDto, ProgressUpdateDto, SaveBaselineDto,
  SetAllocationDto, UpdateTaskDto, UpdateWbsNodeDto,
} from './scheduling.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Scheduling (WBS / Tasks / CPM / Gantt / Baselines / Resources)')
@ApiBearerAuth()
@Controller('projects/:projectId/schedule')
export class SchedulingController {
  constructor(private readonly svc: SchedulingService) {}

  // WBS
  @Get('wbs') @RequirePermission('schedule', 'read')
  listWbs(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.listWbs(projectId);
  }
  @Post('wbs') @RequirePermission('schedule', 'create')
  createWbs(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: CreateWbsNodeDto) {
    return this.svc.createWbs(projectId, dto);
  }
  @Patch('wbs/:id') @RequirePermission('schedule', 'update')
  updateWbs(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWbsNodeDto) {
    return this.svc.updateWbs(id, dto);
  }
  @Delete('wbs/:id') @RequirePermission('schedule', 'delete')
  removeWbs(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.removeWbs(id);
  }

  // Tasks
  @Get('tasks') @RequirePermission('schedule', 'read')
  listTasks(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('status') status?: TaskStatus,
    @Query('critical') critical?: string,
  ) {
    return this.svc.listTasks(projectId, {
      status,
      critical: critical === undefined ? undefined : critical === 'true',
    });
  }
  @Post('tasks') @RequirePermission('schedule', 'create')
  createTask(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: CreateTaskDto) {
    return this.svc.createTask(projectId, dto);
  }
  @Patch('tasks/:id') @RequirePermission('schedule', 'update')
  updateTask(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto) {
    return this.svc.updateTask(id, dto);
  }
  @Delete('tasks/:id') @RequirePermission('schedule', 'delete')
  removeTask(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.removeTask(id);
  }
  @Post('tasks/:id/progress') @RequirePermission('schedule', 'update')
  logProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProgressUpdateDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.logProgress(id, dto, userId);
  }

  // Dependencies
  @Post('tasks/:id/dependencies') @RequirePermission('schedule', 'update')
  addDependency(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) successorId: string,
    @Body() dto: CreateDependencyDto,
  ) {
    return this.svc.addDependency(projectId, { ...dto, successorId });
  }
  @Delete('dependencies/:depId') @RequirePermission('schedule', 'update')
  removeDependency(@Param('depId', ParseUUIDPipe) depId: string) {
    return this.svc.removeDependency(depId);
  }

  // CPM
  @Post('cpm/run') @RequirePermission('schedule', 'update')
  @ApiOperation({ summary: 'Run CPM engine: forward/backward pass, float, critical path' })
  runCpm(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.runCpm(projectId);
  }

  // Gantt
  @Get('gantt') @RequirePermission('schedule', 'read')
  gantt(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.ganttData(projectId);
  }

  // Baselines
  @Get('baselines') @RequirePermission('schedule', 'read')
  listBaselines(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.listBaselines(projectId);
  }
  @Post('baselines') @RequirePermission('schedule', 'create')
  saveBaseline(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: SaveBaselineDto) {
    return this.svc.saveBaseline(projectId, dto.name);
  }
  @Post('baselines/:id/activate') @RequirePermission('schedule', 'update')
  activateBaseline(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.activateBaseline(id);
  }

  // Delay analysis
  @Get('delay-analysis') @RequirePermission('schedule', 'read')
  delayAnalysis(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.delayAnalysis(projectId);
  }

  // Resources
  @Get('resources/matrix') @RequirePermission('schedule', 'read')
  resourceMatrix(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('year') year?: string,
  ) {
    return this.svc.resourceMatrix(projectId, Number(year) || new Date().getFullYear());
  }
  @Post('resources/allocations') @RequirePermission('schedule', 'update')
  setAllocation(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: SetAllocationDto) {
    return this.svc.setAllocation(projectId, dto.employeeId, dto.year, dto.month, dto.utilizationPct);
  }
  @Get('resources/histogram') @RequirePermission('schedule', 'read')
  histogram(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.resourceHistogram(projectId);
  }
}
