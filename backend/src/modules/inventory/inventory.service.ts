import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { dec, round2 } from '../../common/utils/numbers';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Materials master ----
  async listMaterials(companyId: string, search?: string) {
    const materials = await this.prisma.material.findMany({
      where: {
        companyId,
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        defaultSupplier: { select: { id: true, name: true } },
        stockLevels: { include: { warehouse: { select: { code: true, name: true } } } },
        movements: { where: { type: 'ISSUE' }, select: { quantity: true } },
      },
      orderBy: { code: 'asc' },
    });
    return materials.map((m) => {
      const inStock = m.stockLevels.reduce((s, l) => s + dec(l.quantity), 0);
      const used = m.movements.reduce((s, mv) => s + Math.abs(dec(mv.quantity)), 0);
      const { movements: _mv, ...rest } = m;
      return {
        ...rest,
        totalStock: round2(inStock),
        totalUsed: round2(used),
        stockValue: round2(inStock * dec(m.unitCost)),
        belowReorder: dec(m.reorderLevel) > 0 && inStock < dec(m.reorderLevel),
      };
    });
  }

  createMaterial(companyId: string, dto: any) {
    return this.prisma.material.create({ data: { ...dto, companyId } });
  }
  updateMaterial(id: string, dto: any) {
    return this.prisma.material.update({ where: { id }, data: dto });
  }
  async removeMaterial(id: string) {
    await this.prisma.material.update({ where: { id }, data: { isActive: false } });
    return { success: true };
  }

  // ---- Warehouses ----
  listWarehouses(companyId: string) {
    return this.prisma.warehouse.findMany({
      where: { companyId },
      include: { stockLevels: { include: { material: true } } },
      orderBy: { code: 'asc' },
    });
  }
  createWarehouse(companyId: string, dto: any) {
    return this.prisma.warehouse.create({ data: { ...dto, companyId } });
  }
  updateWarehouse(id: string, dto: any) {
    return this.prisma.warehouse.update({ where: { id }, data: dto });
  }

  // ---- Stock movements ----
  listMovements(filters: { warehouseId?: string; materialId?: string; projectId?: string }) {
    return this.prisma.stockMovement.findMany({
      where: {
        ...(filters.warehouseId && { warehouseId: filters.warehouseId }),
        ...(filters.materialId && { materialId: filters.materialId }),
        ...(filters.projectId && { projectId: filters.projectId }),
      },
      include: {
        material: { select: { code: true, name: true, unit: true } },
        warehouse: { select: { code: true, name: true } },
      },
      orderBy: { date: 'desc' },
      take: 300,
    });
  }

  /** Manual stock movement (issue / adjustment / transfer / return). */
  async createMovement(dto: any, userId?: string) {
    const outbound = ['ISSUE', 'TRANSFER_OUT'].includes(dto.type);
    const qty = Math.abs(Number(dto.quantity));

    return this.prisma.$transaction(async (tx) => {
      const level = await tx.stockLevel.findUnique({
        where: { warehouseId_materialId: { warehouseId: dto.warehouseId, materialId: dto.materialId } },
      });
      const current = dec(level?.quantity);
      if (outbound && current < qty) {
        throw new BadRequestException(`Insufficient stock: available ${current}, requested ${qty}`);
      }
      const delta = outbound || (dto.type === 'ADJUSTMENT' && Number(dto.quantity) < 0) ? -qty : qty;
      await tx.stockLevel.upsert({
        where: { warehouseId_materialId: { warehouseId: dto.warehouseId, materialId: dto.materialId } },
        create: { warehouseId: dto.warehouseId, materialId: dto.materialId, quantity: delta },
        update: { quantity: { increment: delta } },
      });
      return tx.stockMovement.create({
        data: { ...dto, quantity: delta, createdById: userId, date: dto.date ?? new Date() },
      });
    });
  }

  // ---- Material requests (site → warehouse) ----
  listMaterialRequests(projectId: string) {
    return this.prisma.materialRequest.findMany({
      where: { projectId },
      include: { lines: { include: { material: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createMaterialRequest(projectId: string, dto: any, userId?: string) {
    const count = await this.prisma.materialRequest.count();
    const { lines, ...rest } = dto;
    return this.prisma.materialRequest.create({
      data: {
        ...rest,
        projectId,
        requestedById: userId,
        number: dto.number ?? `MR-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
        lines: lines ? { create: lines } : undefined,
      },
      include: { lines: true },
    });
  }

  approveMaterialRequest(id: string, approve: boolean) {
    return this.prisma.materialRequest.update({
      where: { id },
      data: { status: approve ? 'APPROVED' : 'REJECTED' },
    });
  }

  /** Issue approved MR from a warehouse — creates ISSUE movements and updates line issued qty. */
  async issueMaterialRequest(id: string, warehouseId: string, userId?: string) {
    const mr = await this.prisma.materialRequest.findUniqueOrThrow({
      where: { id },
      include: { lines: true },
    });
    if (mr.status !== 'APPROVED' && mr.status !== 'PARTIALLY_ISSUED') {
      throw new BadRequestException(`Material request is ${mr.status}; must be APPROVED`);
    }
    return this.prisma.$transaction(async (tx) => {
      for (const line of mr.lines) {
        const remaining = dec(line.quantity) - dec(line.issuedQty);
        if (remaining <= 0) continue;
        const level = await tx.stockLevel.findUnique({
          where: { warehouseId_materialId: { warehouseId, materialId: line.materialId } },
        });
        const available = dec(level?.quantity);
        const toIssue = Math.min(available, remaining);
        if (toIssue <= 0) continue;
        await tx.stockLevel.update({
          where: { warehouseId_materialId: { warehouseId, materialId: line.materialId } },
          data: { quantity: { decrement: toIssue } },
        });
        await tx.stockMovement.create({
          data: {
            warehouseId, materialId: line.materialId, projectId: mr.projectId,
            type: 'ISSUE', quantity: -toIssue, reference: mr.number, createdById: userId,
          },
        });
        await tx.materialRequestLine.update({
          where: { id: line.id },
          data: { issuedQty: { increment: toIssue } },
        });
      }
      const lines = await tx.materialRequestLine.findMany({ where: { materialRequestId: id } });
      const fully = lines.every((l) => dec(l.issuedQty) >= dec(l.quantity) - 0.0005);
      const some = lines.some((l) => dec(l.issuedQty) > 0);
      return tx.materialRequest.update({
        where: { id },
        data: { status: fully ? 'ISSUED' : some ? 'PARTIALLY_ISSUED' : mr.status },
        include: { lines: { include: { material: true } } },
      });
    });
  }

  /** Inventory dashboard. */
  async inventorySummary(companyId: string) {
    const materials = await this.listMaterials(companyId);
    return {
      materialCount: materials.length,
      totalStockValue: round2(materials.reduce((s, m) => s + m.stockValue, 0)),
      belowReorderCount: materials.filter((m) => m.belowReorder).length,
      belowReorder: materials.filter((m) => m.belowReorder).map((m) => ({
        id: m.id, code: m.code, name: m.name, totalStock: m.totalStock, reorderLevel: m.reorderLevel,
      })),
    };
  }
}
