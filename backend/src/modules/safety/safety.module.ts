import { Body, Controller, Get, Module, Param, ParseUUIDPipe, Patch, Post, Injectable } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Injectable()
export class SafetyService {
  constructor(private readonly prisma: PrismaService) {}

  listIncidents(projectId: string) {
    return this.prisma.safetyIncident.findMany({ where: { projectId }, orderBy: { date: 'desc' } });
  }
  createIncident(projectId: string, dto: any, userId?: string) {
    return this.prisma.safetyIncident.create({
      data: {
        ...dto, projectId, reportedById: userId,
        isLti: dto.isLti ?? ['LOST_TIME', 'FATALITY'].includes(dto.severity),
      },
    });
  }
  updateIncident(id: string, dto: any) {
    return this.prisma.safetyIncident.update({ where: { id }, data: dto });
  }

  listToolboxTalks(projectId: string) {
    return this.prisma.toolboxTalk.findMany({ where: { projectId }, orderBy: { date: 'desc' } });
  }
  createToolboxTalk(projectId: string, dto: any) {
    return this.prisma.toolboxTalk.create({ data: { ...dto, projectId } });
  }

  async safetySummary(projectId: string) {
    const [incidents, talks, attendance] = await Promise.all([
      this.prisma.safetyIncident.findMany({ where: { projectId } }),
      this.prisma.toolboxTalk.count({ where: { projectId } }),
      this.prisma.attendance.aggregate({
        where: { projectId, status: 'PRESENT' },
        _sum: { hoursWorked: true, otHours: true },
      }),
    ]);
    const manHours = Number(attendance._sum.hoursWorked ?? 0) + Number(attendance._sum.otHours ?? 0);
    const ltiCount = incidents.filter((i) => i.isLti).length;
    // LTIFR per 1,000,000 man-hours (industry standard)
    const ltifr = manHours > 0 ? Math.round((ltiCount / manHours) * 1_000_000 * 100) / 100 : null;
    const lastLti = incidents.filter((i) => i.isLti).sort((a, b) => +b.date - +a.date)[0];
    const bySeverity: Record<string, number> = {};
    for (const i of incidents) bySeverity[i.severity] = (bySeverity[i.severity] ?? 0) + 1;
    return {
      totalIncidents: incidents.length,
      ltiCount,
      bySeverity,
      toolboxTalks: talks,
      totalManHours: manHours,
      ltifr,
      daysSinceLastLti: lastLti
        ? Math.floor((Date.now() - lastLti.date.getTime()) / 86_400_000)
        : null,
    };
  }
}

@ApiTags('Safety (Incidents / Toolbox Talks / LTIFR)')
@ApiBearerAuth()
@Controller('projects/:projectId/safety')
export class SafetyController {
  constructor(private readonly svc: SafetyService) {}

  @Get('incidents') @RequirePermission('safety', 'read')
  listIncidents(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.listIncidents(projectId);
  }
  @Post('incidents') @RequirePermission('safety', 'create')
  createIncident(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: any) {
    return this.svc.createIncident(projectId, dto);
  }
  @Patch('incidents/:id') @RequirePermission('safety', 'update')
  updateIncident(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.svc.updateIncident(id, dto);
  }

  @Get('toolbox-talks') @RequirePermission('safety', 'read')
  listTalks(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.listToolboxTalks(projectId);
  }
  @Post('toolbox-talks') @RequirePermission('safety', 'create')
  createTalk(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: any) {
    return this.svc.createToolboxTalk(projectId, dto);
  }

  @Get('summary') @RequirePermission('safety', 'read')
  summary(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.safetySummary(projectId);
  }
}

@Module({ controllers: [SafetyController], providers: [SafetyService] })
export class SafetyModule {}
