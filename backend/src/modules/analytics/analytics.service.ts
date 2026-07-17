import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { dec, round2 } from '../../common/utils/numbers';
import { FinanceService } from '../finance/finance.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService,
  ) {}

  /** Executive dashboard — portfolio level. */
  async executiveDashboard(companyId: string) {
    const projects = await this.prisma.project.findMany({
      where: { companyId, status: { notIn: ['CANCELLED'] } },
      include: {
        client: { select: { name: true } },
        _count: { select: { issues: true, risks: true } },
      },
    });

    const perProject = [] as any[];
    for (const p of projects) {
      const evm = await this.finance.evm(p.id).catch(() => null);
      perProject.push({
        id: p.id, code: p.code, name: p.name, status: p.status,
        client: p.client?.name ?? null,
        progressPct: dec(p.progressPct),
        contractValue: dec(p.contractValue),
        startDate: p.startDate, finishDate: p.finishDate,
        spi: evm?.spi ?? null, cpi: evm?.cpi ?? null,
        eac: evm?.eac ?? null, profitForecast: evm?.profitForecast ?? null,
        health: evm?.health ?? 'UNKNOWN',
        openIssues: p._count.issues, openRisks: p._count.risks,
      });
    }

    const active = perProject.filter((p) => p.status === 'ACTIVE');
    return {
      portfolio: {
        projectCount: projects.length,
        activeCount: active.length,
        totalContractValue: round2(perProject.reduce((s, p) => s + p.contractValue, 0)),
        totalProfitForecast: round2(perProject.reduce((s, p) => s + (p.profitForecast ?? 0), 0)),
        avgSpi: active.length
          ? round2(active.reduce((s, p) => s + (p.spi ?? 1), 0) / active.length)
          : null,
        avgCpi: active.length
          ? round2(active.reduce((s, p) => s + (p.cpi ?? 1), 0) / active.length)
          : null,
        atRisk: perProject.filter((p) => p.health !== 'ON_TRACK' && p.health !== 'UNKNOWN').length,
      },
      projects: perProject,
    };
  }

  /** Single-project command centre — replaces the workbook Dashboard sheet. */
  async projectDashboard(projectId: string) {
    const [project, evm, taskStats, milestones, costControl, cashflow, riskCount, issueCount, voSummary, upcomingTasks, criticalTasks] =
      await Promise.all([
        this.prisma.project.findUniqueOrThrow({
          where: { id: projectId },
          include: { client: { select: { name: true } } },
        }),
        this.finance.evm(projectId),
        this.prisma.task.groupBy({
          by: ['status'],
          where: { projectId, isSummary: false },
          _count: true,
        }),
        this.prisma.milestone.findMany({ where: { projectId }, orderBy: { targetDate: 'asc' } }),
        this.finance.costControl(projectId),
        this.finance.cashflow(projectId),
        this.prisma.risk.count({ where: { projectId, status: { in: ['ACTIVE', 'MONITOR', 'IDENTIFIED'] } } }),
        this.prisma.issue.count({ where: { projectId, status: { in: ['OPEN', 'IN_PROGRESS', 'ESCALATED'] } } }),
        this.prisma.variationOrder.aggregate({
          where: { projectId, clientStatus: 'APPROVED' },
          _sum: { netAmount: true },
        }),
        this.prisma.task.findMany({
          where: { projectId, isSummary: false, status: { in: ['NOT_STARTED', 'IN_PROGRESS'] } },
          orderBy: { plannedStart: 'asc' },
          take: 8,
          select: { id: true, code: true, name: true, plannedStart: true, plannedFinish: true, status: true, progressPct: true },
        }),
        this.prisma.task.count({ where: { projectId, isCritical: true, status: { not: 'COMPLETED' } } }),
      ]);

    const daysRemaining = Math.max(
      0,
      Math.ceil((project.finishDate.getTime() - Date.now()) / 86_400_000),
    );

    return {
      project: {
        id: project.id, code: project.code, name: project.name,
        client: project.client?.name, location: project.location,
        status: project.status, startDate: project.startDate, finishDate: project.finishDate,
        contractValue: dec(project.contractValue),
        currency: project.currency,
        progressPct: dec(project.progressPct),
        daysRemaining,
      },
      kpis: {
        overallProgress: dec(project.progressPct),
        budgetUtilized: costControl.totals.budget > 0
          ? round2(costControl.totals.actual / costControl.totals.budget)
          : 0,
        cpi: evm.cpi, spi: evm.spi,
        costToDate: evm.ac,
        profitForecast: evm.profitForecast,
        revisedContract: evm.revisedContract,
        health: evm.health,
        criticalOpenTasks: criticalTasks,
      },
      taskBreakdown: Object.fromEntries(taskStats.map((t) => [t.status, t._count])),
      budgetByCategory: costControl.categories,
      milestones,
      cashflowInsights: cashflow.insights,
      governance: {
        openRisks: riskCount,
        openIssues: issueCount,
        approvedVariations: dec(voSummary._sum.netAmount),
      },
      upcomingTasks: upcomingTasks.map((t) => ({ ...t, progressPct: dec(t.progressPct) })),
      evm,
    };
  }

  /** KPI dashboard: cross-domain indicator panel. */
  async kpis(projectId: string) {
    const [evm, quality, safety, rfiOpen, submittalPending, poCount, delayedTasks] = await Promise.all([
      this.finance.evm(projectId),
      this.prisma.ncr.count({ where: { projectId, status: { not: 'CLOSED' } } }),
      this.prisma.safetyIncident.count({ where: { projectId, isLti: true } }),
      this.prisma.rfi.count({ where: { projectId, status: 'OPEN' } }),
      this.prisma.submittal.count({ where: { projectId, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
      this.prisma.purchaseOrder.count({ where: { projectId } }),
      this.prisma.task.count({ where: { projectId, status: 'DELAYED' } }),
    ]);
    return {
      schedule: { spi: evm.spi, delayedTasks },
      cost: { cpi: evm.cpi, eac: evm.eac, vac: evm.vac, tcpi: evm.tcpi },
      quality: { openNcrs: quality },
      safety: { ltiCount: safety },
      documents: { openRfis: rfiOpen, pendingSubmittals: submittalPending },
      procurement: { poCount },
    };
  }

  /** Global search across major entities. */
  async globalSearch(companyId: string, q: string) {
    if (!q || q.trim().length < 2) return { results: [] };
    const term = q.trim();
    const contains = { contains: term, mode: 'insensitive' as const };

    const [projects, tasks, parties, materials, pos, invoices, documents, employees] = await Promise.all([
      this.prisma.project.findMany({
        where: { companyId, OR: [{ name: contains }, { code: contains }] },
        take: 5, select: { id: true, code: true, name: true },
      }),
      this.prisma.task.findMany({
        where: { project: { companyId }, name: contains },
        take: 8,
        select: { id: true, code: true, name: true, projectId: true, status: true },
      }),
      this.prisma.party.findMany({
        where: { companyId, OR: [{ name: contains }, { code: contains }] },
        take: 5, select: { id: true, code: true, name: true, type: true },
      }),
      this.prisma.material.findMany({
        where: { companyId, OR: [{ name: contains }, { code: contains }] },
        take: 5, select: { id: true, code: true, name: true, unit: true },
      }),
      this.prisma.purchaseOrder.findMany({
        where: { project: { companyId }, OR: [{ number: contains }, { description: contains }] },
        take: 5, select: { id: true, number: true, description: true, projectId: true, status: true },
      }),
      this.prisma.invoice.findMany({
        where: { project: { companyId }, OR: [{ number: contains }, { description: contains }] },
        take: 5, select: { id: true, number: true, projectId: true, status: true },
      }),
      this.prisma.document.findMany({
        where: { project: { companyId }, title: contains },
        take: 5, select: { id: true, title: true, category: true, projectId: true },
      }),
      this.prisma.employee.findMany({
        where: { companyId, OR: [{ firstName: contains }, { lastName: contains }, { position: contains }] },
        take: 5, select: { id: true, code: true, firstName: true, lastName: true, position: true },
      }),
    ]);

    return {
      results: [
        ...projects.map((r) => ({ type: 'project', ...r })),
        ...tasks.map((r) => ({ type: 'task', ...r })),
        ...parties.map((r) => ({ ...r, type: 'party' as const, partyType: r.type })),
        ...materials.map((r) => ({ type: 'material', ...r })),
        ...pos.map((r) => ({ type: 'purchase-order', ...r })),
        ...invoices.map((r) => ({ type: 'invoice', ...r })),
        ...documents.map((r) => ({ type: 'document', ...r })),
        ...employees.map((r) => ({ type: 'employee', ...r })),
      ],
    };
  }
}
