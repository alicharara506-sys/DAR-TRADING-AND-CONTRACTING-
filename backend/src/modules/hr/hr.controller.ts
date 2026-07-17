import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HrService } from './hr.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('HR (Employees / Attendance / Payroll / Training)')
@ApiBearerAuth()
@Controller('hr')
export class HrController {
  constructor(private readonly svc: HrService) {}

  @Get('employees') @RequirePermission('hr', 'read')
  listEmployees(
    @CurrentUser('companyId') companyId: string,
    @Query('department') department?: string,
    @Query('search') search?: string,
  ) {
    return this.svc.listEmployees(companyId, { department, search });
  }
  @Post('employees') @RequirePermission('hr', 'create')
  createEmployee(@CurrentUser('companyId') companyId: string, @Body() dto: any) {
    return this.svc.createEmployee(companyId, dto);
  }
  @Patch('employees/:id') @RequirePermission('hr', 'update')
  updateEmployee(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.svc.updateEmployee(id, dto);
  }
  @Delete('employees/:id') @RequirePermission('hr', 'delete')
  removeEmployee(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.removeEmployee(id);
  }

  @Get('attendance') @RequirePermission('hr', 'read')
  listAttendance(
    @Query('projectId') projectId?: string,
    @Query('employeeId') employeeId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.listAttendance({
      projectId, employeeId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }
  @Post('attendance') @RequirePermission('hr', 'create')
  markAttendance(@Body() dto: any) {
    return this.svc.markAttendance({ ...dto, date: new Date(dto.date) });
  }
  @Post('attendance/bulk') @RequirePermission('hr', 'create')
  bulkAttendance(@Body() body: { entries: any[] }) {
    return this.svc.bulkAttendance(body.entries.map((e) => ({ ...e, date: new Date(e.date) })));
  }

  @Get('payroll') @RequirePermission('payroll', 'read')
  listPayroll(@CurrentUser('companyId') companyId: string) {
    return this.svc.listPayrollRuns(companyId);
  }
  @Post('payroll/generate') @RequirePermission('payroll', 'create')
  @ApiOperation({ summary: 'Generate payroll run from attendance (dailyRate×days + otRate×otHours)' })
  generatePayroll(
    @CurrentUser('companyId') companyId: string,
    @Body() body: { year: number; month: number },
  ) {
    return this.svc.generatePayroll(companyId, body.year, body.month);
  }
  @Post('payroll/:id/approve') @RequirePermission('payroll', 'approve')
  approvePayroll(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() body: { projectIdForCosting?: string },
  ) {
    return this.svc.approvePayroll(id, userId, body.projectIdForCosting);
  }

  @Get('trainings') @RequirePermission('hr', 'read')
  listTrainings(@Query('employeeId') employeeId?: string) {
    return this.svc.listTrainings(employeeId);
  }
  @Post('trainings') @RequirePermission('hr', 'create')
  createTraining(@Body() dto: any) {
    return this.svc.createTraining(dto);
  }

  @Get('summary') @RequirePermission('hr', 'read')
  summary(@CurrentUser('companyId') companyId: string) {
    return this.svc.hrSummary(companyId);
  }
}
