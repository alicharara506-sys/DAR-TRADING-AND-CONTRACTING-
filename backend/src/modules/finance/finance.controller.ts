import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Finance (Budget / Cost Control / EVM / Cash Flow / Invoices / BOQ)')
@ApiBearerAuth()
@Controller()
export class FinanceController {
  constructor(private readonly svc: FinanceService) {}

  // ---- Cost codes ----
  @Get('projects/:projectId/finance/cost-codes') @RequirePermission('finance', 'read')
  listCostCodes(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.listCostCodes(projectId);
  }
  @Post('projects/:projectId/finance/cost-codes') @RequirePermission('finance', 'create')
  createCostCode(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: any) {
    return this.svc.createCostCode(projectId, dto);
  }
  @Patch('finance/cost-codes/:id') @RequirePermission('finance', 'update')
  updateCostCode(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.svc.updateCostCode(id, dto);
  }
  @Delete('finance/cost-codes/:id') @RequirePermission('finance', 'delete')
  removeCostCode(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.removeCostCode(id);
  }

  // ---- Budget ----
  @Get('projects/:projectId/finance/budget') @RequirePermission('finance', 'read')
  listBudget(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.listBudgetLines(projectId);
  }
  @Post('projects/:projectId/finance/budget') @RequirePermission('finance', 'create')
  createBudget(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: any) {
    return this.svc.createBudgetLine(projectId, dto);
  }
  @Patch('finance/budget/:id') @RequirePermission('finance', 'update')
  updateBudget(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.svc.updateBudgetLine(id, dto);
  }
  @Delete('finance/budget/:id') @RequirePermission('finance', 'delete')
  removeBudget(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.removeBudgetLine(id);
  }

  // ---- Cost entries ----
  @Get('projects/:projectId/finance/cost-entries') @RequirePermission('finance', 'read')
  listCostEntries(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('costCodeId') costCodeId?: string,
  ) {
    return this.svc.listCostEntries(projectId, { costCodeId });
  }
  @Post('projects/:projectId/finance/cost-entries') @RequirePermission('finance', 'create')
  createCostEntry(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: any) {
    return this.svc.createCostEntry(projectId, dto);
  }
  @Delete('finance/cost-entries/:id') @RequirePermission('finance', 'delete')
  removeCostEntry(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.removeCostEntry(id);
  }

  // ---- Cost control / EVM / forecast ----
  @Get('projects/:projectId/finance/cost-control') @RequirePermission('finance', 'read')
  costControl(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.costControl(projectId);
  }
  @Get('projects/:projectId/finance/evm') @RequirePermission('finance', 'read')
  @ApiOperation({ summary: 'Live EVM metrics: PV EV AC CPI SPI EAC ETC VAC TCPI' })
  evm(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.evm(projectId);
  }
  @Get('projects/:projectId/finance/evm-curve') @RequirePermission('finance', 'read')
  evmCurve(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.evmCurve(projectId);
  }
  @Get('projects/:projectId/finance/forecast') @RequirePermission('finance', 'read')
  forecast(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.costForecast(projectId);
  }
  @Get('projects/:projectId/finance/summary') @RequirePermission('finance', 'read')
  summary(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.financeSummary(projectId);
  }

  // ---- Cash flow ----
  @Get('projects/:projectId/finance/cashflow') @RequirePermission('finance', 'read')
  cashflow(@Param('projectId', ParseUUIDPipe) projectId: string, @Query('year') year?: string) {
    return this.svc.cashflow(projectId, year ? Number(year) : undefined);
  }
  @Post('projects/:projectId/finance/cashflow') @RequirePermission('finance', 'update')
  upsertCashflow(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: any) {
    return this.svc.upsertCashflowLine(projectId, dto);
  }

  // ---- Invoices ----
  @Get('projects/:projectId/invoices') @RequirePermission('invoices', 'read')
  listInvoices(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.listInvoices(projectId);
  }
  @Post('projects/:projectId/invoices') @RequirePermission('invoices', 'create')
  createInvoice(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: any) {
    return this.svc.createInvoice(projectId, dto);
  }
  @Patch('invoices/:id') @RequirePermission('invoices', 'update')
  updateInvoice(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.svc.updateInvoice(id, dto);
  }
  @Post('invoices/:id/receipts') @RequirePermission('invoices', 'update')
  addReceipt(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.svc.addReceipt(id, dto);
  }

  // ---- Supplier payments ----
  @Get('supplier-payments') @RequirePermission('payments', 'read')
  listSupplierPayments(
    @Query('projectId') projectId?: string,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.svc.listSupplierPayments(projectId, supplierId);
  }
  @Post('supplier-payments') @RequirePermission('payments', 'create')
  createSupplierPayment(@Body() dto: any) {
    return this.svc.createSupplierPayment(dto);
  }

  // ---- BOQ ----
  @Get('projects/:projectId/boq') @RequirePermission('boq', 'read')
  listBoq(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.listBoq(projectId);
  }
  @Post('projects/:projectId/boq') @RequirePermission('boq', 'create')
  createBoq(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: any) {
    return this.svc.createBoqItem(projectId, dto);
  }
  @Patch('boq/:id') @RequirePermission('boq', 'update')
  updateBoq(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.svc.updateBoqItem(id, dto);
  }
  @Delete('boq/:id') @RequirePermission('boq', 'delete')
  removeBoq(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.removeBoqItem(id);
  }

  // ---- Estimates ----
  @Get('projects/:projectId/estimates') @RequirePermission('estimation', 'read')
  listEstimates(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.listEstimates(projectId);
  }
  @Post('projects/:projectId/estimates') @RequirePermission('estimation', 'create')
  createEstimate(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: any) {
    return this.svc.createEstimate(projectId, dto);
  }
  @Get('estimates/:id/summary') @RequirePermission('estimation', 'read')
  estimateSummary(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.estimateSummary(id);
  }
}
