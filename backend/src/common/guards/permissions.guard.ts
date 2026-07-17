import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthUser } from '../decorators/current-user.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<{ resource: string; action: string }>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const user: AuthUser = context.switchToHttp().getRequest().user;
    if (!user) return false;
    if (user.roleName === 'ADMIN') return true;
    const key = `${required.resource}:${required.action}`;
    const wildcard = `${required.resource}:*`;
    if (user.permissions?.includes(key) || user.permissions?.includes(wildcard)) return true;
    throw new ForbiddenException(`Missing permission ${key}`);
  }
}
