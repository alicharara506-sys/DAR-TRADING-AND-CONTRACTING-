import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { differenceInCalendarDays } from 'date-fns';
import { PrismaService } from '../../prisma/prisma.service';
import { dec, round2, safeDiv } from '../../common/utils/numbers';
import { computeEvm } from '../scheduling/cpm.engine';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================================
  // Cost codes & budget
  // =========================================================================
  listCostCodes(projectId: string) {
    return this.prisma.costCode.findMany({
      where: { projectId },
      orderBy: { code: 'asc' },
      include: { budgetLines: true, _count: { select: { costEntries: true } } },
    });
  }

  createCostCode(projectId: string, dto: any) {
    return this.prisma.costCode.create({ data: { ...dto, projectId } });
  }

  updateCostCode(id: string, dto: any) {
    return this.prisma.costCode.update({ where: { id }, data: dto });
  }

  async removeCostCode(id: string) {
    const entries = await this.prisma.costEntry.count({ where: { costCodeId: id } });
    if (entries > 0) throw new BadRequestException('Cost code has posted entries');
    await this.prisma.costCode.delete({ where: { id } });
    return { success: true };
  }

  listBudgetLines(projectId: string) {
    return this.prisma.budgetLine.findMany({
      where: { projectId },
      include: { costCode: true },
      orderBy: { costCode: { code: 'asc' } },
    });
  }

  createBudgetLine(projectId: string, dto: any) {
    return this.prisma.budgetLine.create({
      data: { ...dto, projectId, revisedBudget: dto.revisedBudget ?? dto.originalBudget },
    });
  }

  updateBudgetLine(id: string, dto: any) {
    return this.prisma.budgetLine.update({ where: { id }, data: dto });
  }

  async removeBudgetLine(id: string) {
    await this.prisma.budgetLine.delete({ where: { id } });
    return { success: true };
  }

  // =========================================================================
  // Cost entries (actuals ledger)
  // =========================================================================
  async listCostEntries(projectId: string, opts: { costCodeId?: string; from?: Date; to?: Date } = {}) {
    return this.prisma.costEntry.findMany({
      where: {
        projectId,
        ...(opts.costCodeId && { costCodeId: opts.costCodeId }),
        ...(opts.from || opts.to
          ? { date: { ...(opts.from && { gte: opts.from }), ...(opts.to && { lte: opts.to }) } }
          : {}),
      },
      include: { costCode: true },
      orderBy: { date: 'desc' },
      take: 500,
    });
  }

  createCostEntry(projectId: string, dto: any) {
    return this.prisma.costEntry.create({ data: { ...dto, projectId } });
  }

  async removeCostEntry(id: string) {
    await this.prisma.costEntry.delete({ where: { id } });
    return { success: true };
  }

  // =========================================================================
  // Cost control report — budget vs actual vs forecast by code & category
  // =========================================================================
  async costControl(projectId: string) {
    const [codes, actuals] = await Promise.all([
      this.prisma.costCode.findMany({
        where: { projectId },
        include: { budgetLines: true },
        orderBy: { code: 'asc' },
      }),
      this.prisma.costEntry.groupBy({
        by: ['costCodeId'],
        where: { projectId },
        _sum: { amount: true },
      }),
    ]);
    const actualByCode = new Map(actuals.map((a) => [a.costCodeId, dec(a._sum.amount)]));

    const lines = codes.map((c) => {
      const budget = c.budgetLines.reduce((s, b) => s + dec(b.revisedBudget), 0);
      const forecast = c.budgetLines.reduce((s, b) => s + dec(b.forecastCost || b.revisedBudget), 0);
      const actual = actualByCode.get(c.id) ?? 0;
      const variance = budget - actual;
      const utilization = safeDiv(actual, budget);
      let status = 'ON_TRACK';
      if (actual > budget) status = 'OVER_BUDGET';
      else if (utilization >= 0.95) status = 'AT_RISK';
      else if (actual === 0 && budget > 0) status = 'NOT_STARTED';
      return {
        id: c.id, code: c.code, name: c.name, category: c.category,
        budget: round2(budget), actual: round2(actual), forecast: round2(forecast),
        variance: round2(variance), utilization: Math.round(utilization * 1000) / 1000, status,
      };
    });

    const byCategory = new Map<string, { budget: number; actual: number; forecast: number }>();
    for (const l of lines) {
      const agg = byCategory.get(l.category) ?? { budget: 0, actual: 0, forecast: 0 };
      agg.budget += l.budget;
      agg.actual += l.actual;
      agg.forecast += l.forecast;
      byCategory.set(l.category, agg);
    }

    return {
      lines,
      categories: [...byCategory.entries()].map(([category, v]) => ({
        category,
        budget: round2(v.budget), actual: round2(v.actual), forecast: round2(v.forecast),
        variance: round2(v.budget - v.actual),
        utilization: Math.round(safeDiv(v.actual, v.budget) * 1000) / 1000,
      })),
      totals: {
        budget: round2(lines.reduce((s, l) => s + l.budget, 0)),
        actual: round2(lines.reduce((s, l) => s + l.actual, 0)),
        forecast: round2(lines.reduce((s, l) => s + l.forecast, 0)),
        variance: round2(lines.reduce((s, l) => s + l.variance, 0)),
      },
    };
  }

  // =========================================================================
  // Earned Value Management — computed live from schedule + cost ledger
  // =========================================================================
  async evm(projectId: string, asOf: Date = new Date()) {
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    const [tasks, acAgg, baseline] = await Promise.all([
      this.prisma.task.findMany({
        where: { projectId, isSummary: false },
        select: { id: true, budget: true, progressPct: true, plannedStart: true, plannedFinish: true },
      }),
      this.prisma.costEntry.aggregate({
        where: { projectId, date: { lte: asOf } },
        _sum: { amount: true },
      }),
      this.prisma.baseline.findFirst({ where: { projectId, isActive: true }, include: { tasks: true } }),
    ]);

    const baselineByTask = new Map(baseline?.tasks.map((b) => [b.taskId, b]) ?? []);

    let bac = 0;
    let pv = 0;
    let ev = 0;
    for (const t of tasks) {
      const base = baselineByTask.get(t.id);
      const budget = dec(base?.budget ?? t.budget);
      const start = base?.plannedStart ?? t.plannedStart;
      const finish = base?.plannedFinish ?? t.plannedFinish;
      bac += budget;
      // planned % complete by elapsed schedule time (linear earning rule)
      const total = Math.max(1, differenceInCalendarDays(finish, start));
      const elapsed = Math.min(total, Math.max(0, differenceInCalendarDays(asOf, start)));
      pv += budget * (elapsed / total);
      ev += budget * dec(t.progressPct);
    }
    const ac = dec(acAgg._sum.amount);
    const metrics = computeEvm({ bac, pv, ev, ac });

    const contractValue = dec(project.contractValue);
    const approvedVOs = await this.prisma.variationOrder.aggregate({
      where: { projectId, clientStatus: 'APPROVED' },
      _sum: { netAmount: true },
    });
    const revisedContract = contractValue + dec(approvedVOs._sum.netAmount);
    const profitForecast = round2(revisedContract - metrics.eac);

    return {
      asOf,
      ...metrics,
      contractValue: round2(contractValue),
      revisedContract: round2(revisedContract),
      profitForecast,
      profitMarginForecast: Math.round(safeDiv(profitForecast, revisedContract) * 1000) / 1000,
      health:
        metrics.cpi >= 1 && metrics.spi >= 0.95 ? 'ON_TRACK'
        : metrics.cpi >= 0.9 && metrics.spi >= 0.85 ? 'AT_RISK'
        : 'CRITICAL',
    };
  }

  /** S-curve: monthly PV / EV / AC series for charting. */
  async evmCurve(projectId: string) {
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    const months: Date[] = [];
    const cursor = new Date(project.startDate.getFullYear(), project.startDate.getMonth(), 1);
    const end = new Date();
    const finish = project.finishDate > end ? project.finishDate : end;
    while (cursor <= finish) {
      months.push(new Date(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }
    const series = [] as Array<{ month: string; pv: number; ev: number | null; ac: number | null }>;
    for (const m of months) {
      const monthEnd = new Date(m.getFullYear(), m.getMonth() + 1, 0);
      const snapshot = await this.evm(projectId, monthEnd);
      const isFuture = monthEnd > end;
      series.push({
        month: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`,
        pv: snapshot.pv,
        ev: isFuture ? null : snapshot.ev,
        ac: isFuture ? null : snapshot.ac,
      });
    }
    return series;
  }

  // =========================================================================
  // Cash flow — actuals from ledgers + manual forecast lines
  // =========================================================================
  async cashflow(projectId: string, year?: number) {
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    const y = year ?? project.startDate.getFullYear();

    const [forecastLines, receipts, supplierPayments, costEntries] = await Promise.all([
      this.prisma.cashflowLine.findMany({ where: { projectId, year: y } }),
      this.prisma.paymentReceipt.findMany({
        where: { invoice: { projectId }, date: { gte: new Date(y, 0, 1), lte: new Date(y, 11, 31) } },
      }),
      this.prisma.supplierPayment.findMany({
        where: {
          purchaseOrder: { projectId },
          date: { gte: new Date(y, 0, 1), lte: new Date(y, 11, 31) },
        },
      }),
      this.prisma.costEntry.findMany({
        where: { projectId, date: { gte: new Date(y, 0, 1), lte: new Date(y, 11, 31) } },
        include: { costCode: true },
      }),
    ]);

    const monthly = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      plannedIncome: 0, actualIncome: 0,
      plannedExpense: 0, actualExpense: 0,
      categories: {} as Record<string, { planned: number; actual: number; isIncome: boolean }>,
    }));

    for (const l of forecastLines) {
      const m = monthly[l.month - 1];
      const planned = dec(l.planned);
      const actual = dec(l.actual);
      if (l.isIncome) m.plannedIncome += planned;
      else m.plannedExpense += planned;
      m.categories[l.category] = {
        planned: round2(planned),
        actual: round2(actual),
        isIncome: l.isIncome,
      };
    }
    for (const r of receipts) monthly[r.date.getMonth()].actualIncome += dec(r.amount);
    for (const p of supplierPayments) monthly[p.date.getMonth()].actualExpense += dec(p.amount);
    for (const c of costEntries) {
      // labour/indirect etc. posted directly to cost ledger (not via supplier payments)
      if (c.source === 'PAYROLL' || c.source === 'MANUAL' || c.source === 'EQUIPMENT') {
        monthly[c.date.getMonth()].actualExpense += dec(c.amount);
      }
    }

    let runningPlanned = 0;
    let runningActual = 0;
    const rows = monthly.map((m) => {
      const netPlanned = m.plannedIncome - m.plannedExpense;
      const netActual = m.actualIncome - m.actualExpense;
      runningPlanned += netPlanned;
      runningActual += netActual;
      return {
        ...m,
        plannedIncome: round2(m.plannedIncome), actualIncome: round2(m.actualIncome),
        plannedExpense: round2(m.plannedExpense), actualExpense: round2(m.actualExpense),
        netPlanned: round2(netPlanned), netActual: round2(netActual),
        runningPlanned: round2(runningPlanned), runningActual: round2(runningActual),
      };
    });

    const worstMonth = rows.reduce((min, r) => (r.runningPlanned < min.runningPlanned ? r : min), rows[0]);
    return {
      year: y,
      rows,
      insights: {
        peakNegativeBalance: worstMonth.runningPlanned,
        peakNegativeMonth: worstMonth.month,
        totalPlannedIncome: round2(rows.reduce((s, r) => s + r.plannedIncome, 0)),
        totalPlannedExpense: round2(rows.reduce((s, r) => s + r.plannedExpense, 0)),
      },
    };
  }

  upsertCashflowLine(projectId: string, dto: any) {
    return this.prisma.cashflowLine.upsert({
      where: {
        projectId_year_month_category: {
          projectId, year: dto.year, month: dto.month, category: dto.category,
        },
      },
      create: { ...dto, projectId },
      update: { planned: dto.planned, actual: dto.actual, isIncome: dto.isIncome },
    });
  }

  // =========================================================================
  // Client invoices
  // =========================================================================
  async listInvoices(projectId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: { projectId },
      include: { client: { select: { id: true, name: true } }, receipts: true },
      orderBy: { issueDate: 'desc' },
    });
    const today = new Date();
    return invoices.map((inv) => {
      const received = inv.receipts.reduce((s, r) => s + dec(r.amount), 0);
      const outstanding = dec(inv.totalAmount) - received;
      const overdueDays =
        outstanding > 0.005 && inv.dueDate < today && !['DRAFT', 'CANCELLED'].includes(inv.status)
          ? differenceInCalendarDays(today, inv.dueDate)
          : 0;
      return { ...inv, received: round2(received), outstanding: round2(outstanding), overdueDays };
    });
  }

  /** Auto-computes VAT, retention and advance recovery from project contract terms. */
  async createInvoice(projectId: string, dto: any) {
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    const net = Number(dto.netAmount);
    const vat = dto.vatAmount ?? round2(net * dec(project.vatRate));
    const retention = dto.retentionAmount ?? round2(net * dec(project.retentionRate));
    const advance = dto.advanceRecovery ?? round2(net * dec(project.advanceRate));
    const total = round2(net + vat - retention - advance);
    return this.prisma.invoice.create({
      data: {
        projectId,
        clientId: dto.clientId ?? project.clientId,
        number: dto.number,
        description: dto.description,
        issueDate: dto.issueDate,
        dueDate: dto.dueDate,
        netAmount: net,
        vatAmount: vat,
        retentionAmount: retention,
        advanceRecovery: advance,
        totalAmount: total,
        status: dto.status ?? 'DRAFT',
      },
    });
  }

  updateInvoice(id: string, dto: any) {
    return this.prisma.invoice.update({ where: { id }, data: dto });
  }

  async addReceipt(invoiceId: string, dto: any) {
    const receipt = await this.prisma.paymentReceipt.create({ data: { ...dto, invoiceId } });
    // auto-update invoice status
    const invoice = await this.prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { receipts: true },
    });
    const received = invoice.receipts.reduce((s, r) => s + dec(r.amount), 0);
    let status: InvoiceStatus = invoice.status;
    if (received >= dec(invoice.totalAmount) - 0.005) status = 'PAID';
    else if (received > 0) status = 'PARTIALLY_PAID';
    await this.prisma.invoice.update({ where: { id: invoiceId }, data: { status } });
    return receipt;
  }

  // =========================================================================
  // Supplier payments
  // =========================================================================
  listSupplierPayments(projectId?: string, supplierId?: string) {
    return this.prisma.supplierPayment.findMany({
      where: {
        ...(projectId && { purchaseOrder: { projectId } }),
        ...(supplierId && { supplierId }),
      },
      include: {
        supplier: { select: { id: true, name: true } },
        purchaseOrder: { select: { id: true, number: true, totalAmount: true } },
      },
      orderBy: { date: 'desc' },
      take: 500,
    });
  }

  async createSupplierPayment(dto: any) {
    const payment = await this.prisma.supplierPayment.create({ data: dto });
    if (dto.purchaseOrderId) {
      const po = await this.prisma.purchaseOrder.findUniqueOrThrow({
        where: { id: dto.purchaseOrderId },
        include: { payments: true },
      });
      const paid = po.payments.reduce((s, p) => s + dec(p.amount), 0);
      const status = paid >= dec(po.totalAmount) - 0.005 ? 'PAID' : 'PARTIALLY_PAID';
      await this.prisma.purchaseOrder.update({ where: { id: po.id }, data: { status } });
    }
    return payment;
  }

  // =========================================================================
  // BOQ & Estimation
  // =========================================================================
  listBoq(projectId: string) {
    return this.prisma.boqItem.findMany({ where: { projectId }, orderBy: { itemNo: 'asc' } });
  }

  createBoqItem(projectId: string, dto: any) {
    return this.prisma.boqItem.create({
      data: { ...dto, projectId, amount: round2(Number(dto.quantity) * Number(dto.unitRate)) },
    });
  }

  updateBoqItem(id: string, dto: any) {
    const data = { ...dto };
    if (dto.quantity !== undefined || dto.unitRate !== undefined) {
      // recompute amount when qty/rate changes
      return this.prisma.boqItem.findUniqueOrThrow({ where: { id } }).then((item) =>
        this.prisma.boqItem.update({
          where: { id },
          data: {
            ...data,
            amount: round2(
              Number(dto.quantity ?? item.quantity) * Number(dto.unitRate ?? item.unitRate),
            ),
          },
        }),
      );
    }
    return this.prisma.boqItem.update({ where: { id }, data });
  }

  async removeBoqItem(id: string) {
    await this.prisma.boqItem.delete({ where: { id } });
    return { success: true };
  }

  listEstimates(projectId: string) {
    return this.prisma.estimate.findMany({
      where: { projectId },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createEstimate(projectId: string, dto: any) {
    const { lines, ...rest } = dto;
    return this.prisma.estimate.create({
      data: {
        ...rest,
        projectId,
        lines: lines
          ? {
              create: lines.map((l: any) => ({
                ...l,
                total: round2(Number(l.quantity) * Number(l.unitCost)),
              })),
            }
          : undefined,
      },
      include: { lines: true },
    });
  }

  async estimateSummary(id: string) {
    const estimate = await this.prisma.estimate.findUniqueOrThrow({
      where: { id },
      include: { lines: true },
    });
    const directCost = estimate.lines.reduce((s, l) => s + dec(l.total), 0);
    const contingency = directCost * dec(estimate.contingencyPct);
    const subtotal = directCost + contingency;
    const markup = subtotal * dec(estimate.markupPct);
    return {
      ...estimate,
      summary: {
        directCost: round2(directCost),
        contingency: round2(contingency),
        markup: round2(markup),
        proposedPrice: round2(subtotal + markup),
      },
    };
  }

  // =========================================================================
  // Budget forecast — trend-based cost prediction (least-squares regression)
  // =========================================================================
  async costForecast(projectId: string) {
    const entries = await this.prisma.costEntry.findMany({
      where: { projectId },
      orderBy: { date: 'asc' },
      select: { date: true, amount: true },
    });
    const evm = await this.evm(projectId);
    if (entries.length < 2) {
      return { method: 'EVM_ONLY', evmEac: evm.eac, regressionEac: null, blendedEac: evm.eac, monthlyBurn: [], evm };
    }

    // monthly burn series
    const byMonth = new Map<string, number>();
    for (const e of entries) {
      const key = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, '0')}`;
      byMonth.set(key, (byMonth.get(key) ?? 0) + dec(e.amount));
    }
    const months = [...byMonth.entries()].map(([month, amount], i) => ({ i, month, amount: round2(amount) }));

    // least-squares on cumulative spend
    let cumulative = 0;
    const points = months.map((m) => {
      cumulative += m.amount;
      return { x: m.i, y: cumulative };
    });
    const n = points.length;
    const sumX = points.reduce((s, p) => s + p.x, 0);
    const sumY = points.reduce((s, p) => s + p.y, 0);
    const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
    const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
    const slope = safeDiv(n * sumXY - sumX * sumY, n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    const remainingMonths = Math.max(
      0,
      (project.finishDate.getFullYear() - new Date().getFullYear()) * 12 +
        (project.finishDate.getMonth() - new Date().getMonth()),
    );
    const projectedFinalIndex = n - 1 + remainingMonths;
    const regressionEac = round2(Math.max(cumulative, slope * projectedFinalIndex + intercept));
    const blendedEac = round2(0.6 * evm.eac + 0.4 * regressionEac);

    return {
      method: 'BLENDED_EVM_REGRESSION',
      evmEac: evm.eac,
      regressionEac,
      blendedEac,
      monthlyBurnRate: round2(slope),
      monthlyBurn: months,
      remainingMonths,
      evm,
    };
  }

  // =========================================================================
  // Finance dashboard aggregate
  // =========================================================================
  async financeSummary(projectId: string) {
    const [project, evm, invoices, poAgg, voAgg] = await Promise.all([
      this.prisma.project.findUniqueOrThrow({ where: { id: projectId } }),
      this.evm(projectId),
      this.listInvoices(projectId),
      this.prisma.purchaseOrder.aggregate({ where: { projectId }, _sum: { totalAmount: true } }),
      this.prisma.variationOrder.aggregate({
        where: { projectId, clientStatus: 'APPROVED' },
        _sum: { netAmount: true },
      }),
    ]);
    const invoiced = invoices.reduce((s, i) => s + dec(i.totalAmount), 0);
    const received = invoices.reduce((s, i) => s + i.received, 0);
    return {
      contractValue: dec(project.contractValue),
      approvedVariations: dec(voAgg._sum.netAmount),
      revisedContract: dec(project.contractValue) + dec(voAgg._sum.netAmount),
      invoiced: round2(invoiced),
      received: round2(received),
      outstandingAR: round2(invoiced - received),
      committedPOs: dec(poAgg._sum.totalAmount),
      evm,
    };
  }
}
