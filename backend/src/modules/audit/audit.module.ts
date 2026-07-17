import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDto, paginate, pageArgs } from '../../common/dto/pagination.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(dto: PaginationDto & { resource?: string; userId?: string; action?: string }) {
    const where = {
      ...(dto.resource && { resource: dto.resource }),
      ...(dto.userId && { userId: dto.userId }),
      ...(dto.action && { action: dto.action }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        ...pageArgs(dto),
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginate(data, total, dto);
  }
}

@ApiTags('Audit Trail')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly svc: AuditService) {}

  @Get()
  @RequirePermission('audit', 'read')
  list(
    @Query() dto: PaginationDto,
    @Query('resource') resource?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
  ) {
    return this.svc.list({ ...dto, resource, userId, action });
  }
}

@Module({ controllers: [AuditController], providers: [AuditService] })
export class AuditModule {}
