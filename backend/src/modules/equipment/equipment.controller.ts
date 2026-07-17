import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EquipmentService } from './equipment.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Equipment (Fleet / Maintenance / Fuel)')
@ApiBearerAuth()
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly svc: EquipmentService) {}

  @Get() @RequirePermission('equipment', 'read')
  list(@CurrentUser('companyId') companyId: string, @Query('projectId') projectId?: string) {
    return this.svc.list(companyId, projectId);
  }
  @Post() @RequirePermission('equipment', 'create')
  create(@CurrentUser('companyId') companyId: string, @Body() dto: any) {
    return this.svc.create(companyId, dto);
  }
  @Patch(':id') @RequirePermission('equipment', 'update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.svc.update(id, dto);
  }
  @Delete(':id') @RequirePermission('equipment', 'delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(id);
  }

  @Post(':id/assignments') @RequirePermission('equipment', 'update')
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.svc.assign(id, dto);
  }
  @Patch('assignments/:assignmentId') @RequirePermission('equipment', 'update')
  updateAssignment(@Param('assignmentId', ParseUUIDPipe) assignmentId: string, @Body() dto: any) {
    return this.svc.updateAssignment(assignmentId, dto);
  }

  @Get('maintenance/all') @RequirePermission('equipment', 'read')
  listMaintenance(@Query('equipmentId') equipmentId?: string) {
    return this.svc.listMaintenance(equipmentId);
  }
  @Post('maintenance') @RequirePermission('equipment', 'create')
  createMaintenance(@Body() dto: any) {
    return this.svc.createMaintenance(dto);
  }
  @Post('maintenance/:id/complete') @RequirePermission('equipment', 'update')
  completeMaintenance(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.svc.completeMaintenance(id, dto);
  }

  @Get(':id/fuel-logs') @RequirePermission('equipment', 'read')
  listFuel(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.listFuelLogs(id);
  }
  @Post(':id/fuel-logs') @RequirePermission('equipment', 'create')
  createFuel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.svc.createFuelLog(id, dto);
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  refreshOverdueCron() {
    return this.svc.refreshOverdue();
  }
}
