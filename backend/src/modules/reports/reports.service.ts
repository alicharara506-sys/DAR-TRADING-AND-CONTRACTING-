import { Injectable } from '@nestjs/common';
import { ReportType } from '@prisma/client';
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek, subDays } from 'date-fns';
import { PrismaService } from '../../prisma/prisma.service';
import { dec, round2 } from '../../common/utils/numbers';
import { FinanceService } from '../finance/finance.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService,
  ) {}

  // =========================================================================
  // Daily site reports
  // =========================================================================
  listDaily(projectId: string) {
    return this.prisma.dailyReport.findMany({
      where: { projectId },
      include: { manpowerLines: true, equipmentLines: true },
      orderBy: { date: 'desc' },
      take: 60,
    });
  }

  createDaily(projectId: string, dto: any, userId?: string) {
    const { manpowerLines, equipmentLines, ...rest } = dto;
    return this.prisma.dailyReport.create({
      data: {
        ...rest,
        projectId,
        preparedById: userId,
        manpowerLines: manpowerLines ? { create: manpowerLines } : undefined,
        equipmentLines: equipmentLines ? { create: equipmentLines } : undefined,
      },
      include: { manpowerLines: true, equipmentLines: true },
    });
  }

  async updateDaily(id: string, dto: any) {
    const { manpowerLines, equipmentLines, ...rest } = dto;
    if (manpowerLines) {
      await this.prisma.dailyManpowerLine.deleteMany({ where: { dailyReportId: id } });
      await this.prisma.dailyManpowerLine.createMany({
        data: manpowerLines.map((l: any) => ({ ...l, dailyReportId: id })),
      });
    }
    if (equipmentLines) {
      await this.prisma.dailyEquipmentLine.deleteMany({ where: { dailyReportId: id } });
      await this.prisma.dailyEquipmentLine.createMany({
        data: equipmentLines.map((l: any) => ({ ...l, dailyReportId: id })),
      });
    }
    return this.prisma.dailyReport.update({
      where: { id },
      data: rest,
      include: { manpowerLines: true, equipmentLines: true },
    });
  }

  // =========================================================================
  // Progress reports (weekly / monthly) — auto-generated content
  // =========================================================================
  listProgress(projectId: string, type?: ReportType) {
    return this.prisma.progressReport.findMany({
      where: { projectId, ...(type && { type }) },
      orderBy: { periodEnd: 'desc' },
    });
  }

  /**
   * Auto-generates a weekly or monthly report from live data:
   * completed & planned activities, EVM snapshot, financials, top risks/issues.
   */
  async generateProgress(projectId: string, type: 'WEEKLY' | 'MONTHLY', refDate = new Date(), userId?: string) {
    const periodStart = type === 'WEEKLY' ? startOfWeek(refDate, { weekStartsOn: 1 }) : startOfMonth(refDate);
    const periodEnd = type === 'WEEKLY' ? endOfWeek(refDate, { weekStartsOn: 1 }) : endOfMonth(refDate);

    const [project, evm, financeSummary, completedTasks, upcomingTasks, risks, issues] = await Promise.all([
      this.prisma.project.findUniqueOrThrow({ where: { id: projectId } }),
      this.finance.evm(projectId, periodEnd),
      this.finance.financeSummary(projectId),
      this.prisma.task.findMany({
        where: {
          projectId, isSummary: false,
          OR: [
            { actualFinish: { gte: periodStart, lte: periodEnd } },
            { status: 'IN_PROGRESS' },
          ],
        },
        orderBy: { plannedFinish: 'asc' },
        take: 15,
      }),
      this.prisma.task.findMany({
        where: {
          projectId, isSummary: false, status: 'NOT_STARTED',
          plannedStart: { lte: new Date(periodEnd.getTime() + 14 * 86_400_000) },
        },
        orderBy: { plannedStart: 'asc' },
        take: 10,
        include: { responsible: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.risk.findMany({
        where: { projectId, status: { in: ['ACTIVE', 'MONITOR', 'IDENTIFIED'] } },
        orderBy: { score: 'desc' },
        take: 5,
      }),
      this.prisma.issue.findMany({
        where: { projectId, status: { in: ['OPEN', 'IN_PROGRESS', 'ESCALATED'] } },
        orderBy: { raisedAt: 'asc' },
        take: 5,
      }),
    ]);

    const scheduleStatus =
      evm.spi >= 0.98 ? 'On Track' : evm.spi >= 0.9 ? 'Slightly Behind' : 'Behind Schedule';
    const costStatus = evm.cpi >= 1 ? 'under budget' : evm.cpi >= 0.95 ? 'on budget' : 'over budget';

    const executiveSummary =
      `Project is ${Math.round(dec(project.progressPct) * 100)}% complete with SPI ${evm.spi} (${scheduleStatus.toLowerCase()}) ` +
      `and CPI ${evm.cpi} (${costStatus}). Earned value ${evm.ev.toLocaleString()} vs actual cost ${evm.ac.toLocaleString()}. ` +
      `Forecast cost at completion ${evm.eac.toLocaleString()} against revised contract ${financeSummary.revisedContract.toLocaleString()}, ` +
      `projected margin ${(evm.vac >= 0 ? '+' : '')}${evm.vac.toLocaleString()}. ` +
      `${issues.length} open issue(s) and ${risks.length} active risk(s) require attention.`;

    return this.prisma.progressReport.create({
      data: {
        projectId,
        type,
        periodStart,
        periodEnd,
        preparedById: userId,
        overallProgressPct: project.progressPct,
        scheduleStatus,
        executiveSummary,
        completedActivities: completedTasks.map((t) => ({
          activity: t.name,
          phase: t.phase,
          completionPct: Math.round(dec(t.progressPct) * 100),
          status: t.status,
        })),
        plannedActivities: upcomingTasks.map((t) => ({
          activity: t.name,
          phase: t.phase,
          responsible: t.responsible ? `${t.responsible.firstName} ${t.responsible.lastName}` : null,
          target: t.plannedStart,
        })),
        kpis: {
          spi: evm.spi, cpi: evm.cpi, pv: evm.pv, ev: evm.ev, ac: evm.ac,
          eac: evm.eac, etc: evm.etc, vac: evm.vac, bac: evm.bac,
          invoiced: financeSummary.invoiced, received: financeSummary.received,
          outstandingAR: financeSummary.outstandingAR,
        },
        risksAndRecommendations: [
          ...risks.map((r) => ({ type: 'RISK', priority: r.score >= 6 ? 'High' : 'Medium', text: r.description, mitigation: r.mitigation })),
          ...issues.map((i) => ({ type: 'ISSUE', priority: i.priority, text: i.description, resolution: i.resolution })),
        ],
      },
    });
  }

  approveProgress(id: string, userId: string) {
    return this.prisma.progressReport.update({
      where: { id },
      data: { status: 'APPROVED', approvedById: userId },
    });
  }

  // =========================================================================
  // Report center: tabular exports (CSV) for any dataset
  // =========================================================================
  async exportCsv(projectId: string, dataset: string): Promise<{ filename: string; csv: string }> {
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const toCsv = (rows: Record<string, unknown>[]) => {
      if (!rows.length) return '';
      const headers = Object.keys(rows[0]);
      return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
    };

    let rows: Record<string, unknown>[] = [];
    switch (dataset) {
      case 'tasks':
        rows = (
          await this.prisma.task.findMany({ where: { projectId }, orderBy: { code: 'asc' } })
        ).map((t) => ({
          id: t.code, name: t.name, phase: t.phase, status: t.status,
          plannedStart: t.plannedStart.toISOString().slice(0, 10),
          plannedFinish: t.plannedFinish.toISOString().slice(0, 10),
          durationDays: t.durationDays, progress: dec(t.progressPct),
          budget: dec(t.budget), critical: t.isCritical, totalFloat: t.totalFloat,
        }));
        break;
      case 'cost-control': {
        const cc = await this.finance.costControl(projectId);
        rows = cc.lines;
        break;
      }
      case 'invoices':
        rows = (await this.finance.listInvoices(projectId)).map((i) => ({
          number: i.number, issueDate: i.issueDate.toISOString().slice(0, 10),
          dueDate: i.dueDate.toISOString().slice(0, 10), status: i.status,
          net: dec(i.netAmount), vat: dec(i.vatAmount), retention: dec(i.retentionAmount),
          total: dec(i.totalAmount), received: i.received, outstanding: i.outstanding,
          overdueDays: i.overdueDays,
        }));
        break;
      case 'risks':
        rows = (await this.prisma.risk.findMany({ where: { projectId } })).map((r) => ({
          code: r.code, description: r.description, category: r.category,
          probability: r.probability, impact: r.impact, score: r.score,
          status: r.status, mitigation: r.mitigation,
        }));
        break;
      case 'purchase-orders':
        rows = (
          await this.prisma.purchaseOrder.findMany({ where: { projectId }, include: { supplier: true } })
        ).map((p) => ({
          number: p.number, supplier: p.supplier.name, description: p.description,
          poDate: p.poDate.toISOString().slice(0, 10), net: dec(p.netAmount),
          vat: dec(p.vatAmount), total: dec(p.totalAmount), status: p.status,
        }));
        break;
      case 'materials':
        rows = (
          await this.prisma.stockMovement.findMany({
            where: { projectId },
            include: { material: true, warehouse: true },
          })
        ).map((m) => ({
          date: m.date.toISOString().slice(0, 10), material: m.material.name,
          warehouse: m.warehouse.name, type: m.type, quantity: dec(m.quantity),
          reference: m.reference,
        }));
        break;
      default:
        rows = [];
    }
    return {
      filename: `${dataset}-${projectId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`,
      csv: toCsv(rows),
    };
  }

  /** Productivity: planned vs actual manpower from daily reports (last 30 days). */
  async productivity(projectId: string) {
    const since = subDays(new Date(), 30);
    const reports = await this.prisma.dailyReport.findMany({
      where: { projectId, date: { gte: since } },
      include: { manpowerLines: true },
      orderBy: { date: 'asc' },
    });
    const series = reports.map((r) => {
      const planned = r.manpowerLines.reduce((s, l) => s + l.planned, 0);
      const actual = r.manpowerLines.reduce((s, l) => s + l.actual, 0);
      return {
        date: r.date.toISOString().slice(0, 10),
        planned, actual,
        attendanceRate: planned > 0 ? round2(actual / planned) : null,
      };
    });
    const avgRate =
      series.filter((s) => s.attendanceRate !== null).reduce((s, r) => s + (r.attendanceRate ?? 0), 0) /
      Math.max(1, series.filter((s) => s.attendanceRate !== null).length);
    return { series, averageAttendanceRate: round2(avgRate) };
  }
}
