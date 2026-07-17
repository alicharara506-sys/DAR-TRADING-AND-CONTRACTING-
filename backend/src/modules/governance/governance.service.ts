import { Injectable } from '@nestjs/common';
import { RiskImpact, RiskProbability } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { dec, round2 } from '../../common/utils/numbers';

const LEVEL: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };

@Injectable()
export class GovernanceService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Risks ----
  listRisks(projectId: string) {
    return this.prisma.risk.findMany({ where: { projectId }, orderBy: [{ score: 'desc' }, { code: 'asc' }] });
  }

  async createRisk(projectId: string, dto: any) {
    const max = await this.prisma.risk.aggregate({ where: { projectId }, _max: { code: true } });
    return this.prisma.risk.create({
      data: {
        ...dto,
        projectId,
        code: (max._max.code ?? 0) + 1,
        score: this.riskScore(dto.probability, dto.impact),
      },
    });
  }

  async updateRisk(id: string, dto: any) {
    const current = await this.prisma.risk.findUniqueOrThrow({ where: { id } });
    const probability = dto.probability ?? current.probability;
    const impact = dto.impact ?? current.impact;
    return this.prisma.risk.update({
      where: { id },
      data: { ...dto, score: this.riskScore(probability, impact) },
    });
  }

  async removeRisk(id: string) {
    await this.prisma.risk.delete({ where: { id } });
    return { success: true };
  }

  private riskScore(p: RiskProbability, i: RiskImpact): number {
    return (LEVEL[p] ?? 2) * (LEVEL[i] ?? 2);
  }

  /** 3x3 probability/impact heat map. */
  async riskMatrix(projectId: string) {
    const risks = await this.prisma.risk.findMany({
      where: { projectId, status: { notIn: ['CLOSED', 'MITIGATED'] } },
    });
    const matrix: { probability: string; impact: string; count: number; risks: any[] }[] = [];
    for (const p of ['HIGH', 'MEDIUM', 'LOW']) {
      for (const i of ['LOW', 'MEDIUM', 'HIGH']) {
        const cell = risks.filter((r) => r.probability === p && r.impact === i);
        matrix.push({
          probability: p, impact: i, count: cell.length,
          risks: cell.map((r) => ({ id: r.id, code: r.code, description: r.description, score: r.score })),
        });
      }
    }
    return { matrix, totalOpen: risks.length, highSeverity: risks.filter((r) => r.score >= 6).length };
  }

  // ---- Issues ----
  listIssues(projectId: string) {
    return this.prisma.issue.findMany({ where: { projectId }, orderBy: { code: 'asc' } });
  }

  async createIssue(projectId: string, dto: any) {
    const max = await this.prisma.issue.aggregate({ where: { projectId }, _max: { code: true } });
    return this.prisma.issue.create({
      data: { ...dto, projectId, code: (max._max.code ?? 0) + 1, raisedAt: dto.raisedAt ?? new Date() },
    });
  }

  updateIssue(id: string, dto: any) {
    const data = { ...dto };
    if (dto.status === 'RESOLVED' && !dto.resolvedAt) data.resolvedAt = new Date();
    return this.prisma.issue.update({ where: { id }, data });
  }

  async removeIssue(id: string) {
    await this.prisma.issue.delete({ where: { id } });
    return { success: true };
  }

  // ---- Variation orders ----
  async listVOs(projectId: string) {
    const [vos, project] = await Promise.all([
      this.prisma.variationOrder.findMany({ where: { projectId }, orderBy: { number: 'asc' } }),
      this.prisma.project.findUniqueOrThrow({ where: { id: projectId } }),
    ]);
    const approvedNet = vos
      .filter((v) => v.clientStatus === 'APPROVED')
      .reduce((s, v) => s + dec(v.netAmount), 0);
    const pendingNet = vos
      .filter((v) => !['APPROVED', 'REJECTED', 'WITHDRAWN'].includes(v.clientStatus))
      .reduce((s, v) => s + dec(v.netAmount), 0);
    const scheduleImpact = vos
      .filter((v) => v.clientStatus === 'APPROVED')
      .reduce((s, v) => s + v.programmeImpactDays, 0);
    return {
      variations: vos,
      summary: {
        originalContract: dec(project.contractValue),
        approvedVariations: round2(approvedNet),
        pendingVariations: round2(pendingNet),
        revisedContract: round2(dec(project.contractValue) + approvedNet),
        approvedScheduleImpactDays: scheduleImpact,
      },
    };
  }

  async createVO(projectId: string, dto: any) {
    const count = await this.prisma.variationOrder.count({ where: { projectId } });
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    const net = Number(dto.netAmount ?? 0);
    const vat = dto.vatAmount ?? (net > 0 ? round2(net * dec(project.vatRate)) : 0);
    return this.prisma.variationOrder.create({
      data: {
        ...dto,
        projectId,
        number: dto.number ?? `VO-${String(count + 1).padStart(3, '0')}`,
        submittedAt: dto.submittedAt ?? new Date(),
        netAmount: net,
        vatAmount: vat,
        totalAmount: round2(net + vat),
      },
    });
  }

  async updateVO(id: string, dto: any) {
    const data = { ...dto };
    if (dto.netAmount !== undefined || dto.vatAmount !== undefined) {
      const current = await this.prisma.variationOrder.findUniqueOrThrow({ where: { id } });
      const net = Number(dto.netAmount ?? current.netAmount);
      const vat = Number(dto.vatAmount ?? current.vatAmount);
      data.totalAmount = round2(net + vat);
    }
    if (dto.clientStatus === 'APPROVED' && !dto.approvalDate) data.approvalDate = new Date();
    return this.prisma.variationOrder.update({ where: { id }, data });
  }

  async removeVO(id: string) {
    await this.prisma.variationOrder.delete({ where: { id } });
    return { success: true };
  }
}
