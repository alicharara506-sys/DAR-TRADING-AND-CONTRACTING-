import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Analytics (Dashboards / KPIs / Global Search)')
@ApiBearerAuth()
@Controller()
export class AnalyticsController {
  constructor(private readonly svc: AnalyticsService) {}

  @Get('dashboards/executive')
  @RequirePermission('dashboard', 'read')
  @ApiOperation({ summary: 'Portfolio-level executive dashboard' })
  executive(@CurrentUser('companyId') companyId: string) {
    return this.svc.executiveDashboard(companyId);
  }

  @Get('dashboards/projects/:projectId')
  @RequirePermission('dashboard', 'read')
  @ApiOperation({ summary: 'Project command centre dashboard' })
  project(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.projectDashboard(projectId);
  }

  @Get('projects/:projectId/kpis')
  @RequirePermission('dashboard', 'read')
  kpis(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.kpis(projectId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Global search across projects, tasks, parties, materials, POs, invoices, documents, employees' })
  search(@CurrentUser('companyId') companyId: string, @Query('q') q: string) {
    return this.svc.globalSearch(companyId, q);
  }
}
