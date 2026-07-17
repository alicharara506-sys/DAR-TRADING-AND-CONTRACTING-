import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Inventory (Materials / Warehouses / Stock / Material Requests)')
@ApiBearerAuth()
@Controller()
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}

  @Get('materials') @RequirePermission('inventory', 'read')
  listMaterials(@CurrentUser('companyId') companyId: string, @Query('search') search?: string) {
    return this.svc.listMaterials(companyId, search);
  }
  @Post('materials') @RequirePermission('inventory', 'create')
  createMaterial(@CurrentUser('companyId') companyId: string, @Body() dto: any) {
    return this.svc.createMaterial(companyId, dto);
  }
  @Patch('materials/:id') @RequirePermission('inventory', 'update')
  updateMaterial(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.svc.updateMaterial(id, dto);
  }
  @Delete('materials/:id') @RequirePermission('inventory', 'delete')
  removeMaterial(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.removeMaterial(id);
  }

  @Get('warehouses') @RequirePermission('inventory', 'read')
  listWarehouses(@CurrentUser('companyId') companyId: string) {
    return this.svc.listWarehouses(companyId);
  }
  @Post('warehouses') @RequirePermission('inventory', 'create')
  createWarehouse(@CurrentUser('companyId') companyId: string, @Body() dto: any) {
    return this.svc.createWarehouse(companyId, dto);
  }
  @Patch('warehouses/:id') @RequirePermission('inventory', 'update')
  updateWarehouse(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.svc.updateWarehouse(id, dto);
  }

  @Get('stock-movements') @RequirePermission('inventory', 'read')
  listMovements(
    @Query('warehouseId') warehouseId?: string,
    @Query('materialId') materialId?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.svc.listMovements({ warehouseId, materialId, projectId });
  }
  @Post('stock-movements') @RequirePermission('inventory', 'create')
  @ApiOperation({ summary: 'Manual stock movement (issue/adjustment/transfer/return)' })
  createMovement(@Body() dto: any, @CurrentUser('id') userId: string) {
    return this.svc.createMovement(dto, userId);
  }

  @Get('projects/:projectId/material-requests') @RequirePermission('inventory', 'read')
  listMRs(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.listMaterialRequests(projectId);
  }
  @Post('projects/:projectId/material-requests') @RequirePermission('inventory', 'create')
  createMR(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: any,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.createMaterialRequest(projectId, dto, userId);
  }
  @Post('material-requests/:id/approve') @RequirePermission('inventory', 'approve')
  approveMR(@Param('id', ParseUUIDPipe) id: string, @Body() body: { approve?: boolean }) {
    return this.svc.approveMaterialRequest(id, body.approve !== false);
  }
  @Post('material-requests/:id/issue') @RequirePermission('inventory', 'update')
  issueMR(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { warehouseId: string },
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.issueMaterialRequest(id, body.warehouseId, userId);
  }

  @Get('inventory/summary') @RequirePermission('inventory', 'read')
  summary(@CurrentUser('companyId') companyId: string) {
    return this.svc.inventorySummary(companyId);
  }
}
