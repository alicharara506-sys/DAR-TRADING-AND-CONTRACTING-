import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, pageArgs } from '../../common/dto/pagination.dto';
import { CreatePartyDto, QueryPartiesDto, UpdatePartyDto } from './parties.dto';

@Injectable()
export class PartiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string, dto: QueryPartiesDto) {
    const where: Prisma.PartyWhereInput = {
      companyId,
      ...(dto.type && { type: dto.type }),
      ...(dto.search && {
        OR: [
          { name: { contains: dto.search, mode: 'insensitive' } },
          { code: { contains: dto.search, mode: 'insensitive' } },
          { contactPerson: { contains: dto.search, mode: 'insensitive' } },
        ],
      }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.party.findMany({
        where,
        ...pageArgs(dto),
        orderBy: { [dto.sortBy ?? 'name']: dto.sortOrder ?? 'asc' },
        include: { _count: { select: { purchaseOrders: true, invoices: true } } },
      }),
      this.prisma.party.count({ where }),
    ]);
    return paginate(data, total, dto);
  }

  async findOne(companyId: string, id: string) {
    const party = await this.prisma.party.findFirst({
      where: { id, companyId },
      include: {
        purchaseOrders: { take: 10, orderBy: { poDate: 'desc' } },
        invoices: { take: 10, orderBy: { issueDate: 'desc' } },
        clientProjects: { select: { id: true, code: true, name: true, status: true } },
      },
    });
    if (!party) throw new NotFoundException('Party not found');
    return party;
  }

  create(companyId: string, dto: CreatePartyDto) {
    return this.prisma.party.create({ data: { ...dto, companyId } });
  }

  async update(companyId: string, id: string, dto: UpdatePartyDto) {
    await this.findOne(companyId, id);
    return this.prisma.party.update({ where: { id }, data: dto });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    await this.prisma.party.update({ where: { id }, data: { isActive: false } });
    return { success: true };
  }

  /** Supplier performance: delivery delays & spend per supplier */
  async supplierPerformance(companyId: string) {
    const suppliers = await this.prisma.party.findMany({
      where: { companyId, type: { in: ['SUPPLIER', 'SUBCONTRACTOR'] } },
      include: {
        purchaseOrders: { include: { receipts: true } },
        supplierPayments: true,
      },
    });
    return suppliers.map((s) => {
      const pos = s.purchaseOrders;
      const totalSpend = pos.reduce((sum, po) => sum + Number(po.totalAmount), 0);
      const paid = s.supplierPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const delays = pos
        .filter((po) => po.expectedDelivery && po.receipts.length)
        .map((po) => {
          const firstReceipt = po.receipts.reduce(
            (min, r) => (r.date < min ? r.date : min),
            po.receipts[0].date,
          );
          return Math.max(
            0,
            Math.round((firstReceipt.getTime() - po.expectedDelivery!.getTime()) / 86_400_000),
          );
        });
      const avgDelayDays = delays.length
        ? Math.round((delays.reduce((a, b) => a + b, 0) / delays.length) * 10) / 10
        : 0;
      return {
        id: s.id, code: s.code, name: s.name, rating: s.rating,
        poCount: pos.length, totalSpend, paid, outstanding: totalSpend - paid, avgDelayDays,
      };
    });
  }
}
