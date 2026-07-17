import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PoStatus } from '@prisma/client';
import { ProcurementService } from './procurement.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Procurement (PR / RFQ / Vendor Comparison / PO / GRN)')
@ApiBearerAuth()
@Controller()
export class ProcurementController {
  constructor(private readonly svc: ProcurementService) {}

  // Purchase requests
  @Get('projects/:projectId/purchase-requests') @RequirePermission('procurement', 'read')
  listPRs(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.listPRs(projectId);
  }
  @Post('projects/:projectId/purchase-requests') @RequirePermission('procurement', 'create')
  createPR(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: any,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.createPR(projectId, dto, userId);
  }
  @Patch('purchase-requests/:id') @RequirePermission('procurement', 'update')
  updatePR(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.svc.updatePR(id, dto);
  }
  @Post('purchase-requests/:id/approve') @RequirePermission('procurement', 'approve')
  approvePR(@Param('id', ParseUUIDPipe) id: string, @Body() body: { approve: boolean }) {
    return this.svc.approvePR(id, body.approve !== false);
  }

  // RFQs
  @Get('projects/:projectId/rfqs') @RequirePermission('procurement', 'read')
  listRfqs(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.listRfqs(projectId);
  }
  @Post('projects/:projectId/rfqs') @RequirePermission('procurement', 'create')
  createRfq(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: any) {
    return this.svc.createRfq(projectId, dto);
  }
  @Post('rfqs/:id/quotations') @RequirePermission('procurement', 'update')
  addQuotation(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.svc.addQuotation(id, dto);
  }
  @Get('rfqs/:id/comparison') @RequirePermission('procurement', 'read')
  @ApiOperation({ summary: 'Weighted vendor comparison: price 50% / delivery 30% / rating 20%' })
  compare(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.compareQuotations(id);
  }
  @Post('quotations/:id/award') @RequirePermission('procurement', 'approve')
  @ApiOperation({ summary: 'Award quotation and auto-generate draft PO' })
  award(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.awardQuotation(id);
  }

  // Purchase orders
  @Get('purchase-orders') @RequirePermission('procurement', 'read')
  listPOs(@Query('projectId') projectId?: string, @Query('status') status?: PoStatus) {
    return this.svc.listPOs(projectId, status);
  }
  @Post('projects/:projectId/purchase-orders') @RequirePermission('procurement', 'create')
  createPO(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: any) {
    return this.svc.createPO(projectId, dto);
  }
  @Patch('purchase-orders/:id') @RequirePermission('procurement', 'update')
  updatePO(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.svc.updatePO(id, dto);
  }
  @Post('purchase-orders/:id/receive') @RequirePermission('procurement', 'update')
  @ApiOperation({ summary: 'Goods receipt — posts stock into warehouse ledger' })
  receive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.receiveGoods(id, dto, userId);
  }

  @Get('procurement/summary') @RequirePermission('procurement', 'read')
  summary(@Query('projectId') projectId?: string) {
    return this.svc.procurementSummary(projectId);
  }
}
