import { Body, Controller, Delete, Get, Module, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Injectable()
export class QualityService {
  constructor(private readonly prisma: PrismaService) {}

  private async nextNumber(model: 'ncr' | 'inspectionRequest' | 'methodStatement', projectId: string, prefix: string) {
    const count = await (this.prisma[model] as any).count({ where: { projectId } });
    return `${prefix}-${String(count + 1).padStart(3, '0')}`;
  }

  listNcrs(projectId: string) {
    return this.prisma.ncr.findMany({ where: { projectId }, orderBy: { raisedAt: 'desc' } });
  }
  async createNcr(projectId: string, dto: any) {
    return this.prisma.ncr.create({
      data: {
        ...dto, projectId,
        number: dto.number ?? (await this.nextNumber('ncr', projectId, 'NCR')),
        raisedAt: dto.raisedAt ?? new Date(),
      },
    });
  }
  updateNcr(id: string, dto: any) {
    const data = { ...dto };
    if (dto.status === 'CLOSED' && !dto.closedAt) data.closedAt = new Date();
    return this.prisma.ncr.update({ where: { id }, data });
  }

  listInspections(projectId: string) {
    return this.prisma.inspectionRequest.findMany({ where: { projectId }, orderBy: { requestedAt: 'desc' } });
  }
  async createInspection(projectId: string, dto: any) {
    return this.prisma.inspectionRequest.create({
      data: {
        ...dto, projectId,
        number: dto.number ?? (await this.nextNumber('inspectionRequest', projectId, 'IR')),
        requestedAt: dto.requestedAt ?? new Date(),
      },
    });
  }
  updateInspection(id: string, dto: any) {
    return this.prisma.inspectionRequest.update({ where: { id }, data: dto });
  }

  listMethodStatements(projectId: string) {
    return this.prisma.methodStatement.findMany({ where: { projectId }, orderBy: { number: 'asc' } });
  }
  async createMethodStatement(projectId: string, dto: any) {
    return this.prisma.methodStatement.create({
      data: {
        ...dto, projectId,
        number: dto.number ?? (await this.nextNumber('methodStatement', projectId, 'MS')),
      },
    });
  }
  updateMethodStatement(id: string, dto: any) {
    return this.prisma.methodStatement.update({ where: { id }, data: dto });
  }

  async qualitySummary(projectId: string) {
    const [ncrs, inspections] = await Promise.all([
      this.prisma.ncr.groupBy({ by: ['status'], where: { projectId }, _count: true }),
      this.prisma.inspectionRequest.groupBy({ by: ['status'], where: { projectId }, _count: true }),
    ]);
    const insp = Object.fromEntries(inspections.map((i) => [i.status, i._count]));
    const passed = insp['PASSED'] ?? 0;
    const failed = insp['FAILED'] ?? 0;
    return {
      ncrByStatus: Object.fromEntries(ncrs.map((n) => [n.status, n._count])),
      inspectionByStatus: insp,
      firstTimePassRate: passed + failed > 0 ? Math.round((passed / (passed + failed)) * 1000) / 1000 : null,
    };
  }
}

@ApiTags('Quality (NCR / Inspections / Method Statements)')
@ApiBearerAuth()
@Controller('projects/:projectId/quality')
export class QualityController {
  constructor(private readonly svc: QualityService) {}

  @Get('ncrs') @RequirePermission('quality', 'read')
  listNcrs(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.listNcrs(projectId);
  }
  @Post('ncrs') @RequirePermission('quality', 'create')
  createNcr(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: any) {
    return this.svc.createNcr(projectId, dto);
  }
  @Patch('ncrs/:id') @RequirePermission('quality', 'update')
  updateNcr(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.svc.updateNcr(id, dto);
  }

  @Get('inspections') @RequirePermission('quality', 'read')
  listInspections(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.listInspections(projectId);
  }
  @Post('inspections') @RequirePermission('quality', 'create')
  createInspection(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: any) {
    return this.svc.createInspection(projectId, dto);
  }
  @Patch('inspections/:id') @RequirePermission('quality', 'update')
  updateInspection(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.svc.updateInspection(id, dto);
  }

  @Get('method-statements') @RequirePermission('quality', 'read')
  listMs(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.listMethodStatements(projectId);
  }
  @Post('method-statements') @RequirePermission('quality', 'create')
  createMs(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: any) {
    return this.svc.createMethodStatement(projectId, dto);
  }
  @Patch('method-statements/:id') @RequirePermission('quality', 'update')
  updateMs(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.svc.updateMethodStatement(id, dto);
  }

  @Get('summary') @RequirePermission('quality', 'read')
  summary(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.qualitySummary(projectId);
  }
}

@Module({ controllers: [QualityController], providers: [QualityService] })
export class QualityModule {}
