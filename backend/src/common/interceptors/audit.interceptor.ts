import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const ACTION_MAP: Record<string, string> = {
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

/** Persists an audit trail entry for every mutating API call. */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Audit');

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    if (!MUTATING.has(req.method) || req.url?.startsWith('/api/v1/auth')) {
      return next.handle();
    }
    const parts: string[] = (req.url ?? '').split('?')[0].split('/').filter(Boolean);
    // /api/v1/<resource>/<id>...
    const resource = parts[2] ?? 'unknown';
    const resourceId = parts[3];

    return next.handle().pipe(
      tap((result) => {
        this.prisma.auditLog
          .create({
            data: {
              userId: req.user?.id ?? null,
              action: ACTION_MAP[req.method] ?? req.method,
              resource,
              resourceId: resourceId ?? result?.id ?? null,
              after: this.sanitize(req.body),
              ip: req.ip,
              userAgent: req.headers['user-agent']?.slice(0, 250),
            },
          })
          .catch((e) => this.logger.warn(`Audit write failed: ${e.message}`));
      }),
    );
  }

  private sanitize(body: unknown) {
    if (!body || typeof body !== 'object') return undefined;
    const clone: Record<string, unknown> = { ...(body as Record<string, unknown>) };
    for (const k of ['password', 'passwordHash', 'currentPassword', 'newPassword', 'refreshToken']) {
      if (k in clone) clone[k] = '***';
    }
    return clone as any;
  }
}
