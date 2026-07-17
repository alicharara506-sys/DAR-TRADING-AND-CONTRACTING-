import { Body, Controller, Get, Injectable, Module, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly && { readAt: null }) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async unreadCount(userId: string) {
    return { count: await this.prisma.notification.count({ where: { userId, readAt: null } }) };
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
    return { success: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { success: true };
  }

  /** Programmatic notify — used by other services & future email hook. */
  notify(userId: string, type: NotificationType, title: string, body?: string, link?: string) {
    return this.prisma.notification.create({ data: { userId, type, title, body, link } });
  }

  async broadcast(companyId: string, type: NotificationType, title: string, body?: string, link?: string) {
    const users = await this.prisma.user.findMany({ where: { companyId, status: 'ACTIVE' }, select: { id: true } });
    await this.prisma.notification.createMany({
      data: users.map((u) => ({ userId: u.id, type, title, body, link })),
    });
    return { sent: users.length };
  }
}

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  list(@CurrentUser('id') userId: string, @Query('unread') unread?: string) {
    return this.svc.list(userId, unread === 'true');
  }
  @Get('unread-count')
  unreadCount(@CurrentUser('id') userId: string) {
    return this.svc.unreadCount(userId);
  }
  @Post(':id/read')
  markRead(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.markRead(userId, id);
  }
  @Post('read-all')
  markAllRead(@CurrentUser('id') userId: string) {
    return this.svc.markAllRead(userId);
  }
}

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
