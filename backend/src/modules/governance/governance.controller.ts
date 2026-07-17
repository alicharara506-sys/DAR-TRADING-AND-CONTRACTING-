import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GovernanceService } from './governance.service';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Governance (Risks / Issues / Variation Orders)')
@ApiBearerAuth()
@Controller()
export class GovernanceController {
  constructor(private readonly svc: GovernanceService) {}

  // Risks
  @Get('projects/:projectId/risks') @RequirePermission('risks', 'read')
  listRisks(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.listRisks(projectId);
  }
  @Get('projects/:projectId/risks/matrix') @RequirePermission('risks', 'read')
  riskMatrix(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.riskMatrix(projectId);
  }
  @Post('projects/:projectId/risks') @RequirePermission('risks', 'create')
  createRisk(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: any) {
    return this.svc.createRisk(projectId, dto);
  }
  @Patch('risks/:id') @RequirePermission('risks', 'update')
  updateRisk(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.svc.updateRisk(id, dto);
  }
  @Delete('risks/:id') @RequirePermission('risks', 'delete')
  removeRisk(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.removeRisk(id);
  }

  // Issues
  @Get('projects/:projectId/issues') @RequirePermission('issues', 'read')
  listIssues(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.listIssues(projectId);
  }
  @Post('projects/:projectId/issues') @RequirePermission('issues', 'create')
  createIssue(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: any) {
    return this.svc.createIssue(projectId, dto);
  }
  @Patch('issues/:id') @RequirePermission('issues', 'update')
  updateIssue(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.svc.updateIssue(id, dto);
  }
  @Delete('issues/:id') @RequirePermission('issues', 'delete')
  removeIssue(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.removeIssue(id);
  }

  // Variation orders
  @Get('projects/:projectId/variation-orders') @RequirePermission('variations', 'read')
  listVOs(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.listVOs(projectId);
  }
  @Post('projects/:projectId/variation-orders') @RequirePermission('variations', 'create')
  createVO(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: any) {
    return this.svc.createVO(projectId, dto);
  }
  @Patch('variation-orders/:id') @RequirePermission('variations', 'update')
  updateVO(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.svc.updateVO(id, dto);
  }
  @Delete('variation-orders/:id') @RequirePermission('variations', 'delete')
  removeVO(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.removeVO(id);
  }
}
