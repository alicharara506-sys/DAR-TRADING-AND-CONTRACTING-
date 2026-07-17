import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PoStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { dec, round2 } from '../../common/utils/numbers';

@Injectable()
export class ProcurementService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================================
  // Purchase Requests
  // =========================================================================
  listPRs(projectId: string) {
    return this.prisma.purchaseRequest.findMany({
      where: { projectId },
      include: { lines: { include: { material: true } }, rfqs: { select: { id: true, number: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPR(projectId: string, dto: any, userId?: string) {
    const count = await this.prisma.purchaseRequest.count();
    const { lines, ...rest } = dto;
    return this.prisma.purchaseRequest.create({
      data: {
        ...rest,
        projectId,
        requestedById: userId,
        number: dto.number ?? `PR-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
        lines: lines ? { create: lines } : undefined,
      },
      include: { lines: true },
    });
  }

  async updatePR(id: string, dto: any) {
    const { lines, ...rest } = dto;
    if (lines) {
      await this.prisma.purchaseRequestLine.deleteMany({ where: { purchaseRequestId: id } });
      await this.prisma.purchaseRequestLine.createMany({
        data: lines.map((l: any) => ({ ...l, purchaseRequestId: id })),
      });
    }
    return this.prisma.purchaseRequest.update({
      where: { id },
      data: rest,
      include: { lines: true },
    });
  }

  approvePR(id: string, approve: boolean) {
    return this.prisma.purchaseRequest.update({
      where: { id },
      data: { status: approve ? 'APPROVED' : 'REJECTED' },
    });
  }

  // =========================================================================
  // RFQ + Quotations + Vendor comparison
  // =========================================================================
  listRfqs(projectId: string) {
    return this.prisma.rfq.findMany({
      where: { projectId },
      include: {
        vendors: { include: { vendor: { select: { id: true, name: true } } } },
        quotations: { include: { vendor: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRfq(projectId: string, dto: any) {
    const count = await this.prisma.rfq.count();
    const { vendorIds, ...rest } = dto;
    return this.prisma.rfq.create({
      data: {
        ...rest,
        projectId,
        number: dto.number ?? `RFQ-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
        vendors: vendorIds
          ? { create: vendorIds.map((vendorId: string) => ({ vendorId, sentAt: new Date() })) }
          : undefined,
        status: vendorIds?.length ? 'SENT' : 'DRAFT',
      },
      include: { vendors: true },
    });
  }

  async addQuotation(rfqId: string, dto: any) {
    const { lines, ...rest } = dto;
    const quote = await this.prisma.quotation.create({
      data: {
        ...rest,
        rfqId,
        lines: lines
          ? { create: lines.map((l: any) => ({ ...l })) }
          : undefined,
      },
      include: { lines: true, vendor: true },
    });
    await this.prisma.rfq.update({ where: { id: rfqId }, data: { status: 'QUOTED' } });
    return quote;
  }

  /** Vendor comparison matrix: price, delivery, rating, weighted score. */
  async compareQuotations(rfqId: string) {
    const rfq = await this.prisma.rfq.findUniqueOrThrow({
      where: { id: rfqId },
      include: { quotations: { include: { vendor: true, lines: true } } },
    });
    if (!rfq.quotations.length) return { rfq: { id: rfq.id, number: rfq.number }, comparison: [] };

    const minPrice = Math.min(...rfq.quotations.map((q) => dec(q.netAmount) || Infinity));
    const minDelivery = Math.min(...rfq.quotations.map((q) => q.deliveryDays ?? Infinity));

    const comparison = rfq.quotations
      .map((q) => {
        const price = dec(q.netAmount);
        const priceScore = price > 0 ? (minPrice / price) * 50 : 0; // 50% weight
        const deliveryScore =
          q.deliveryDays && Number.isFinite(minDelivery) ? (minDelivery / q.deliveryDays) * 30 : 15; // 30% weight
        const ratingScore = ((q.vendor.rating ?? 3) / 5) * 20; // 20% weight
        return {
          quotationId: q.id,
          vendor: { id: q.vendor.id, name: q.vendor.name, rating: q.vendor.rating },
          netAmount: price,
          deliveryDays: q.deliveryDays,
          paymentTerms: q.paymentTerms,
          isAwarded: q.isAwarded,
          score: round2(priceScore + deliveryScore + ratingScore),
          breakdown: {
            price: round2(priceScore),
            delivery: round2(deliveryScore),
            rating: round2(ratingScore),
          },
        };
      })
      .sort((a, b) => b.score - a.score);

    return { rfq: { id: rfq.id, number: rfq.number, description: rfq.description }, comparison };
  }

  /** Award a quotation → generates a draft PO automatically. */
  async awardQuotation(quotationId: string) {
    const quote = await this.prisma.quotation.findUniqueOrThrow({
      where: { id: quotationId },
      include: { lines: true, rfq: true, vendor: true },
    });
    await this.prisma.$transaction([
      this.prisma.quotation.updateMany({ where: { rfqId: quote.rfqId }, data: { isAwarded: false } }),
      this.prisma.quotation.update({ where: { id: quotationId }, data: { isAwarded: true } }),
      this.prisma.rfq.update({ where: { id: quote.rfqId }, data: { status: 'AWARDED' } }),
    ]);

    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: quote.rfq.projectId } });
    const count = await this.prisma.purchaseOrder.count();
    const net = dec(quote.netAmount) || quote.lines.reduce((s, l) => s + dec(l.quantity) * dec(l.unitPrice), 0);
    const vat = round2(net * dec(project.vatRate));

    return this.prisma.purchaseOrder.create({
      data: {
        projectId: quote.rfq.projectId,
        supplierId: quote.vendorId,
        number: `PO-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
        description: quote.rfq.description,
        poDate: new Date(),
        netAmount: net,
        vatAmount: vat,
        totalAmount: round2(net + vat),
        status: 'DRAFT',
        paymentTerms: quote.paymentTerms,
        lines: {
          create: quote.lines.map((l) => ({
            description: l.description,
            unit: l.unit,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
          })),
        },
      },
      include: { lines: true, supplier: true },
    });
  }

  // =========================================================================
  // Purchase Orders
  // =========================================================================
  async listPOs(projectId?: string, status?: PoStatus) {
    const pos = await this.prisma.purchaseOrder.findMany({
      where: { ...(projectId && { projectId }), ...(status && { status }) },
      include: {
        supplier: { select: { id: true, name: true } },
        project: { select: { id: true, code: true, name: true } },
        lines: true,
        payments: true,
        receipts: { select: { id: true, date: true, number: true } },
      },
      orderBy: { poDate: 'desc' },
    });
    return pos.map((po) => {
      const paid = po.payments.reduce((s, p) => s + dec(p.amount), 0);
      return { ...po, paid: round2(paid), outstanding: round2(dec(po.totalAmount) - paid) };
    });
  }

  async createPO(projectId: string, dto: any) {
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    const count = await this.prisma.purchaseOrder.count();
    const { lines, ...rest } = dto;
    const net =
      dto.netAmount ??
      (lines ?? []).reduce((s: number, l: any) => s + Number(l.quantity) * Number(l.unitPrice), 0);
    const vat = dto.vatAmount ?? round2(net * dec(project.vatRate));
    return this.prisma.purchaseOrder.create({
      data: {
        ...rest,
        projectId,
        number: dto.number ?? `PO-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
        netAmount: net,
        vatAmount: vat,
        totalAmount: round2(net + vat),
        lines: lines ? { create: lines } : undefined,
      },
      include: { lines: true },
    });
  }

  updatePO(id: string, dto: any) {
    const { lines: _l, ...rest } = dto;
    return this.prisma.purchaseOrder.update({ where: { id }, data: rest, include: { lines: true } });
  }

  /**
   * Goods receipt: records delivery, updates PO line received qty, PO status
   * and posts stock into the warehouse ledger.
   */
  async receiveGoods(purchaseOrderId: string, dto: any, userId?: string) {
    const po = await this.prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: purchaseOrderId },
      include: { lines: true },
    });
    if (['CANCELLED', 'CLOSED'].includes(po.status)) {
      throw new BadRequestException(`PO is ${po.status}`);
    }
    const grnCount = await this.prisma.goodsReceipt.count();
    const number = dto.number ?? `GRN-${new Date().getFullYear()}-${String(grnCount + 1).padStart(4, '0')}`;

    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.goodsReceipt.create({
        data: {
          purchaseOrderId,
          warehouseId: dto.warehouseId,
          number,
          date: dto.date ?? new Date(),
          receivedById: userId,
          notes: dto.notes,
          lines: { create: dto.lines },
        },
        include: { lines: true },
      });

      // update PO line received quantities + stock
      for (const line of receipt.lines) {
        if (line.materialId) {
          const poLine = po.lines.find((l) => l.materialId === line.materialId);
          if (poLine) {
            await tx.purchaseOrderLine.update({
              where: { id: poLine.id },
              data: { receivedQty: { increment: line.quantity } },
            });
          }
          if (dto.warehouseId) {
            await tx.stockLevel.upsert({
              where: { warehouseId_materialId: { warehouseId: dto.warehouseId, materialId: line.materialId } },
              create: { warehouseId: dto.warehouseId, materialId: line.materialId, quantity: line.quantity },
              update: { quantity: { increment: line.quantity } },
            });
            await tx.stockMovement.create({
              data: {
                warehouseId: dto.warehouseId,
                materialId: line.materialId,
                projectId: po.projectId,
                type: 'RECEIPT',
                quantity: line.quantity,
                reference: number,
                createdById: userId,
              },
            });
          }
        }
      }

      // derive PO delivery status
      const updatedLines = await tx.purchaseOrderLine.findMany({ where: { purchaseOrderId } });
      const fully = updatedLines.every((l) => dec(l.receivedQty) >= dec(l.quantity) - 0.0005);
      const some = updatedLines.some((l) => dec(l.receivedQty) > 0);
      await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: { status: fully ? 'DELIVERED' : some ? 'PARTIALLY_DELIVERED' : po.status },
      });

      return receipt;
    });
  }

  /** Procurement dashboard stats. */
  async procurementSummary(projectId?: string) {
    const where = projectId ? { projectId } : {};
    const [pos, prs, rfqs] = await Promise.all([
      this.prisma.purchaseOrder.findMany({ where, include: { payments: true } }),
      this.prisma.purchaseRequest.groupBy({ by: ['status'], where, _count: true }),
      this.prisma.rfq.groupBy({ by: ['status'], where, _count: true }),
    ]);
    const totalCommitted = pos.reduce((s, p) => s + dec(p.totalAmount), 0);
    const totalPaid = pos.reduce((s, p) => s + p.payments.reduce((x, y) => x + dec(y.amount), 0), 0);
    const byStatus: Record<string, number> = {};
    for (const p of pos) byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
    return {
      poCount: pos.length,
      totalCommitted: round2(totalCommitted),
      totalPaid: round2(totalPaid),
      totalOutstanding: round2(totalCommitted - totalPaid),
      poByStatus: byStatus,
      prByStatus: Object.fromEntries(prs.map((p) => [p.status, p._count])),
      rfqByStatus: Object.fromEntries(rfqs.map((r) => [r.status, r._count])),
    };
  }
}
