import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { dec, round2 } from '../../common/utils/numbers';
import { FinanceService } from '../finance/finance.service';
import { SchedulingService } from '../scheduling/scheduling.service';
import { PartiesService } from '../parties/parties.service';
import { ReportsService } from '../reports/reports.service';

type Intent =
  | 'DELAYS' | 'FORECAST_COMPLETION' | 'EXPLAIN_CPI' | 'CASHFLOW' | 'SUPPLIER_DELAYS'
  | 'RISKS' | 'WEEKLY_REPORT' | 'MONTHLY_REPORT' | 'CLIENT_REPORT' | 'PROFITABILITY'
  | 'COST_FORECAST' | 'GENERAL';

const INTENT_PATTERNS: Array<[Intent, RegExp]> = [
  ['DELAYS', /\b(delay|late|behind|slip|retard|تأخير|متأخر)\b/i],
  ['FORECAST_COMPLETION', /\b(forecast.*(completion|finish)|when.*(finish|complete|done)|completion date|fin du projet|إنجاز|انتهاء)\b/i],
  ['EXPLAIN_CPI', /\b(cpi|cost performance|why.*over.?budget|dépassement)\b/i],
  ['CASHFLOW', /\b(cash ?flow|liquidity|cash position|trésorerie|تدفق نقدي|سيولة)\b/i],
  ['SUPPLIER_DELAYS', /\b(supplier|vendor|fournisseur|مورد).*(delay|late|performance|worst|highest)|which supplier/i],
  ['RISKS', /\b(risk|threat|risque|مخاطر|خطر)\b/i],
  ['WEEKLY_REPORT', /\bweekly (report|summary)|rapport hebdomadaire|تقرير أسبوعي\b/i],
  ['MONTHLY_REPORT', /\bmonthly (report|summary)|rapport mensuel|تقرير شهري\b/i],
  ['CLIENT_REPORT', /\bclient (progress )?report|رسالة العميل|rapport client\b/i],
  ['PROFITABILITY', /\b(profit|margin|rentabilité|ربح|هامش)\b/i],
  ['COST_FORECAST', /\b(predict|forecast).*(cost|budget)|eac|estimate at completion\b/i],
];

@Injectable()
export class AiService {
  private readonly logger = new Logger('AiAssistant');

  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService,
    private readonly scheduling: SchedulingService,
    private readonly parties: PartiesService,
    private readonly reports: ReportsService,
  ) {}

  // =========================================================================
  // Conversations
  // =========================================================================
  listConversations(userId: string) {
    return this.prisma.aiConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      include: { _count: { select: { messages: true } } },
    });
  }

  async getConversation(userId: string, id: string) {
    const conv = await this.prisma.aiConversation.findFirst({
      where: { id, userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    return conv;
  }

  // =========================================================================
  // Main entry: ask a question
  // =========================================================================
  async ask(userId: string, companyId: string, question: string, opts: { projectId?: string; conversationId?: string }) {
    // resolve or create conversation
    let conversationId = opts.conversationId;
    if (!conversationId) {
      const conv = await this.prisma.aiConversation.create({
        data: { userId, projectId: opts.projectId, title: question.slice(0, 80) },
      });
      conversationId = conv.id;
    }
    await this.prisma.aiMessage.create({
      data: { conversationId, role: 'user', content: question },
    });

    // resolve project context
    const projectId = opts.projectId ?? (await this.defaultProject(companyId));
    const intent = this.classify(question);
    const { answer, data } = await this.answer(intent, question, companyId, projectId);

    // optional LLM polish with live data context
    const finalAnswer = await this.maybeEnhanceWithLlm(question, answer, data);

    const message = await this.prisma.aiMessage.create({
      data: { conversationId, role: 'assistant', content: finalAnswer, data: data ?? undefined },
    });
    await this.prisma.aiConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    return { conversationId, message: { ...message, intent } };
  }

  private async defaultProject(companyId: string): Promise<string | undefined> {
    const p = await this.prisma.project.findFirst({
      where: { companyId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    return p?.id;
  }

  private classify(question: string): Intent {
    for (const [intent, pattern] of INTENT_PATTERNS) {
      if (pattern.test(question)) return intent;
    }
    return 'GENERAL';
  }

  // =========================================================================
  // Deterministic insight engine (works with no API key)
  // =========================================================================
  private async answer(
    intent: Intent, question: string, companyId: string, projectId?: string,
  ): Promise<{ answer: string; data?: any }> {
    if (!projectId) {
      return { answer: 'I could not find an active project to analyse. Create or activate a project first.' };
    }
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    const fmt = (n: number) => `${project.currency} ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

    switch (intent) {
      case 'DELAYS': {
        const analysis = await this.scheduling.delayAnalysis(projectId);
        const top = analysis.delayedTasks.slice(0, 6);
        if (!top.length) {
          return { answer: `No delayed activities detected on ${project.name}. All tasks are tracking to plan.`, data: analysis };
        }
        const lines = top.map(
          (t: any) =>
            `• #${t.code} ${t.name.trim()} — ${t.slippageDays > 0 ? `${t.slippageDays} day(s) behind baseline` : `progress gap ${(t.progressGap * 100).toFixed(0)}%`}${t.isCritical ? ' ⚠ CRITICAL PATH' : ''}`,
        );
        return {
          answer:
            `${analysis.delayedCount} of ${analysis.totalTasks} activities are delaying ${project.name} ` +
            `(${analysis.criticalDelayed} on the critical path — these directly push the completion date):\n\n${lines.join('\n')}\n\n` +
            `Recommendation: focus recovery on the critical-path items first; every day recovered there moves the finish date forward.`,
          data: analysis,
        };
      }

      case 'FORECAST_COMPLETION': {
        const [cpm, evm] = await Promise.all([
          this.scheduling.runCpm(projectId, false),
          this.finance.evm(projectId),
        ]);
        const plannedDays = Math.ceil((project.finishDate.getTime() - project.startDate.getTime()) / 86_400_000);
        const spiAdjustedDays = evm.spi > 0 ? Math.ceil(plannedDays / evm.spi) : plannedDays;
        const spiForecast = new Date(project.startDate.getTime() + spiAdjustedDays * 86_400_000);
        return {
          answer:
            `Completion forecast for ${project.name}:\n\n` +
            `• Network (CPM) forecast: ${cpm.forecastFinish.toISOString().slice(0, 10)} (${cpm.projectDurationDays} days total, ${cpm.criticalTaskCount} critical activities)\n` +
            `• Performance-adjusted (SPI ${evm.spi}): ${spiForecast.toISOString().slice(0, 10)}\n` +
            `• Contract finish date: ${project.finishDate.toISOString().slice(0, 10)}\n\n` +
            (evm.spi >= 0.98
              ? 'The project is pacing on schedule; the contract date is achievable.'
              : `At the current pace the project trends ${Math.max(0, spiAdjustedDays - plannedDays)} day(s) past the contract date. Recovery on critical-path activities is required.`),
          data: { cpm, spi: evm.spi },
        };
      }

      case 'EXPLAIN_CPI': {
        const [evm, costControl] = await Promise.all([
          this.finance.evm(projectId),
          this.finance.costControl(projectId),
        ]);
        const overruns = costControl.lines
          .filter((l) => l.status === 'OVER_BUDGET' || l.utilization > 1)
          .sort((a, b) => a.variance - b.variance)
          .slice(0, 5);
        const explanation =
          evm.cpi >= 1
            ? `Your CPI is ${evm.cpi} — you are earning ${fmt(evm.cpi)} of value per ${fmt(1)} spent, i.e. under budget. Keep current cost discipline.`
            : `Your CPI is ${evm.cpi}, below 1. You have spent ${fmt(evm.ac)} but only earned ${fmt(evm.ev)} of budgeted work — a cost overrun of ${fmt(Math.abs(evm.cv))}.` +
              (overruns.length
                ? `\n\nMain drivers (over-running cost codes):\n${overruns.map((o) => `• ${o.code} ${o.name}: spent ${fmt(o.actual)} vs budget ${fmt(o.budget)}`).join('\n')}`
                : '') +
              `\n\nIf this rate continues, cost at completion becomes ${fmt(evm.eac)} vs budget ${fmt(evm.bac)} (VAC ${fmt(evm.vac)}). ` +
              `To finish on budget you must deliver remaining work at a TCPI of ${evm.tcpi}.`;
        return { answer: explanation, data: { evm, overruns } };
      }

      case 'CASHFLOW': {
        const cf = await this.finance.cashflow(projectId);
        const negativeMonths = cf.rows.filter((r) => r.runningPlanned < 0);
        return {
          answer:
            `Cash flow outlook for ${project.name} (${cf.year}):\n\n` +
            `• Planned income: ${fmt(cf.insights.totalPlannedIncome)} · Planned expenditure: ${fmt(cf.insights.totalPlannedExpense)}\n` +
            `• Peak negative running balance: ${fmt(cf.insights.peakNegativeBalance)} in month ${cf.insights.peakNegativeMonth}\n` +
            `• Months in negative territory: ${negativeMonths.length}\n\n` +
            (negativeMonths.length
              ? `Financing need: arrange a working-capital facility of at least ${fmt(Math.abs(cf.insights.peakNegativeBalance))}, or accelerate client invoicing / negotiate supplier terms to smooth the trough.`
              : 'The project remains cash-positive throughout the year on current assumptions.'),
          data: cf,
        };
      }

      case 'SUPPLIER_DELAYS': {
        const perf = await this.parties.supplierPerformance(companyId);
        const worst = perf.filter((s) => s.poCount > 0).sort((a, b) => b.avgDelayDays - a.avgDelayDays).slice(0, 5);
        return {
          answer: worst.length
            ? `Supplier delay ranking (average days late vs promised delivery):\n\n${worst
                .map((s, i) => `${i + 1}. ${s.name} — avg ${s.avgDelayDays} day(s) late over ${s.poCount} PO(s), spend ${fmt(s.totalSpend)}`)
                .join('\n')}\n\nRecommendation: review expediting and penalty clauses for the top offenders; consider dual-sourcing critical materials.`
            : 'No supplier delivery data recorded yet — goods receipts against POs are needed to compute delay statistics.',
          data: worst,
        };
      }

      case 'RISKS': {
        const risks = await this.prisma.risk.findMany({
          where: { projectId, status: { notIn: ['CLOSED', 'MITIGATED'] } },
          orderBy: { score: 'desc' },
        });
        return {
          answer: risks.length
            ? `${risks.length} active risk(s) on ${project.name}, ranked by severity (probability × impact):\n\n${risks
                .slice(0, 8)
                .map((r) => `• [Score ${r.score}] ${r.description} — ${r.category}. Mitigation: ${r.mitigation ?? 'not defined'}`)
                .join('\n')}`
            : `No open risks recorded for ${project.name}.`,
          data: risks,
        };
      }

      case 'WEEKLY_REPORT':
      case 'MONTHLY_REPORT': {
        const type = intent === 'WEEKLY_REPORT' ? 'WEEKLY' : 'MONTHLY';
        const report = await this.reports.generateProgress(projectId, type);
        return {
          answer:
            `${type === 'WEEKLY' ? 'Weekly' : 'Monthly'} report generated for ${project.name} ` +
            `(${report.periodStart.toISOString().slice(0, 10)} → ${report.periodEnd.toISOString().slice(0, 10)}).\n\n` +
            `${report.executiveSummary}\n\nThe full report (activities, KPIs, risks) is saved in Reports and ready for review/approval.`,
          data: report,
        };
      }

      case 'CLIENT_REPORT': {
        const dash = await this.finance.financeSummary(projectId);
        const evm = dash.evm;
        const milestones = await this.prisma.milestone.findMany({ where: { projectId }, orderBy: { targetDate: 'asc' } });
        const text =
          `Dear Client,\n\n` +
          `Progress update — ${project.name} (Contract ${project.contractNumber ?? project.code}):\n\n` +
          `Works are ${Math.round(dec(project.progressPct) * 100)}% complete. ` +
          `Schedule performance stands at SPI ${evm.spi} and cost performance at CPI ${evm.cpi}. ` +
          `Milestone status:\n${milestones
            .map((m) => `• ${m.name}: ${m.status.replace(/_/g, ' ').toLowerCase()} (target ${m.targetDate.toISOString().slice(0, 10)})`)
            .join('\n')}\n\n` +
          `Certified works invoiced to date total ${fmt(dash.invoiced)}, of which ${fmt(dash.received)} has been received. ` +
          `We appreciate your continued cooperation and remain committed to delivering the project to specification.\n\n` +
          `Yours faithfully,\nDAR Trading & Contracting`;
        return { answer: text, data: { milestones, finance: dash } };
      }

      case 'PROFITABILITY': {
        const [evm, voData] = await Promise.all([
          this.finance.evm(projectId),
          this.prisma.variationOrder.aggregate({
            where: { projectId, clientStatus: 'APPROVED' },
            _sum: { netAmount: true },
          }),
        ]);
        const plannedMargin = dec(project.contractValue) - dec(project.directCost) - dec(project.indirectCost);
        const drivers: string[] = [];
        if (evm.cpi < 1) drivers.push(`cost overrun of ${fmt(Math.abs(evm.cv))} (CPI ${evm.cpi})`);
        if (evm.spi < 1) drivers.push(`schedule slippage extending time-related costs (SPI ${evm.spi})`);
        if (dec(voData._sum.netAmount) < 0) drivers.push(`net omission variations of ${fmt(Math.abs(dec(voData._sum.netAmount)))}`);
        return {
          answer:
            `Profitability analysis — ${project.name}:\n\n` +
            `• Original expected margin: ${fmt(plannedMargin)}\n` +
            `• Current forecast margin: ${fmt(evm.profitForecast)} (${(evm.profitMarginForecast * 100).toFixed(1)}% of revised contract)\n` +
            `• Forecast cost at completion: ${fmt(evm.eac)} vs budget ${fmt(evm.bac)}\n\n` +
            (drivers.length
              ? `Why it changed: ${drivers.join('; ')}.`
              : 'Margin is holding at or above plan — no adverse drivers detected.'),
          data: { evm },
        };
      }

      case 'COST_FORECAST': {
        const forecast = await this.finance.costForecast(projectId);
        return {
          answer:
            `Cost prediction for ${project.name} (blended EVM + spend-trend regression):\n\n` +
            `• EVM-based EAC: ${fmt(forecast.evmEac)}\n` +
            (forecast.regressionEac
              ? `• Regression EAC (burn-rate trend): ${fmt(forecast.regressionEac)}\n• Blended prediction: ${fmt(forecast.blendedEac)}\n• Current burn rate ≈ ${fmt(forecast.monthlyBurnRate ?? 0)}/month\n`
              : '') +
            `\nBudget at completion is ${fmt(forecast.evm.bac)}; predicted variance ${fmt(forecast.evm.bac - (forecast.blendedEac ?? forecast.evmEac))}.`,
          data: forecast,
        };
      }

      default: {
        const dash = await this.finance.financeSummary(projectId);
        const taskStats = await this.prisma.task.groupBy({
          by: ['status'], where: { projectId, isSummary: false }, _count: true,
        });
        const stats = Object.fromEntries(taskStats.map((t) => [t.status, t._count]));
        return {
          answer:
            `Snapshot of ${project.name}:\n\n` +
            `• Progress: ${Math.round(dec(project.progressPct) * 100)}% · SPI ${dash.evm.spi} · CPI ${dash.evm.cpi} (${dash.evm.health.replace('_', ' ').toLowerCase()})\n` +
            `• Cost to date ${fmt(dash.evm.ac)} of BAC ${fmt(dash.evm.bac)} · EAC ${fmt(dash.evm.eac)}\n` +
            `• Tasks: ${stats['COMPLETED'] ?? 0} done, ${stats['IN_PROGRESS'] ?? 0} in progress, ${stats['NOT_STARTED'] ?? 0} not started, ${stats['DELAYED'] ?? 0} delayed\n` +
            `• Invoiced ${fmt(dash.invoiced)} / received ${fmt(dash.received)} (AR outstanding ${fmt(dash.outstandingAR)})\n\n` +
            `Ask me things like "Which activities are delaying the project?", "Forecast project completion", "Why is my CPI below 1?", "Predict cash flow", or "Generate weekly report".`,
          data: { finance: dash, taskStats: stats },
        };
      }
    }
  }

  // =========================================================================
  // Optional LLM enhancement (Anthropic API) — graceful no-op without key
  // =========================================================================
  private async maybeEnhanceWithLlm(question: string, draftAnswer: string, data: any): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return draftAnswer;
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL ?? 'claude-sonnet-5',
          max_tokens: 1200,
          system:
            'You are the AI Project Assistant inside a construction ERP for DAR Trading & Contracting. ' +
            'You are given a user question, a draft analytical answer produced by the ERP insight engine from LIVE project data, ' +
            'and the raw data. Rewrite the answer to be clear, professional and actionable. Keep all numbers exactly as given. ' +
            'Answer in the same language as the question (English, Arabic or French).',
          messages: [
            {
              role: 'user',
              content: `Question: ${question}\n\nDraft answer:\n${draftAnswer}\n\nRaw data (JSON):\n${JSON.stringify(data ?? {}).slice(0, 6000)}`,
            },
          ],
        }),
      });
      if (!res.ok) return draftAnswer;
      const body: any = await res.json();
      const text = body?.content?.find((c: any) => c.type === 'text')?.text;
      return text || draftAnswer;
    } catch (e) {
      this.logger.warn(`LLM enhancement skipped: ${(e as Error).message}`);
      return draftAnswer;
    }
  }
}
