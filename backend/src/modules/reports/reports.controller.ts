import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportType } from '@prisma/client';
import { ReportsService } from './reports.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Reports (Daily / Weekly / Monthly / Exports / Productivity)')
@ApiBearerAuth()
@Controller()
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Get('projects/:projectId/daily-reports') @RequirePermission('reports', 'read')
  listDaily(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.listDaily(projectId);
  }
  @Post('projects/:projectId/daily-reports') @RequirePermission('reports', 'create')
  createDaily(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: any,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.createDaily(projectId, { ...dto, date: new Date(dto.date) }, userId);
  }
  @Patch('daily-reports/:id') @RequirePermission('reports', 'update')
  updateDaily(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.svc.updateDaily(id, dto);
  }

  @Get('projects/:projectId/progress-reports') @RequirePermission('reports', 'read')
  listProgress(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('type') type?: ReportType,
  ) {
    return this.svc.listProgress(projectId, type);
  }
  @Post('projects/:projectId/progress-reports/generate') @RequirePermission('reports', 'create')
  @ApiOperation({ summary: 'Auto-generate weekly/monthly report from live project data' })
  generate(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() body: { type: 'WEEKLY' | 'MONTHLY'; refDate?: string },
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.generateProgress(
      projectId, body.type, body.refDate ? new Date(body.refDate) : new Date(), userId,
    );
  }
  @Post('progress-reports/:id/approve') @RequirePermission('reports', 'approve')
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.svc.approveProgress(id, userId);
  }

  @Get('projects/:projectId/exports/:dataset') @RequirePermission('reports', 'export')
  @ApiOperation({ summary: 'CSV export: tasks | cost-control | invoices | risks | purchase-orders | materials' })
  async exportCsv(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('dataset') dataset: string,
    @Res() res: Response,
  ) {
    const { filename, csv } = await this.svc.exportCsv(projectId, dataset);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('﻿' + csv);
  }

  @Get('projects/:projectId/productivity') @RequirePermission('reports', 'read')
  productivity(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.productivity(projectId);
  }
}
