import {
  BadRequestException, Body, Controller, Delete, Get, Injectable, Module, Param, ParseUUIDPipe,
  Patch, Post, Query, Res, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { diskStorage } from 'multer';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { DocumentCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './uploads';
const ALLOWED_EXT = new Set([
  '.pdf', '.dwg', '.dxf', '.png', '.jpg', '.jpeg', '.webp', '.xlsx', '.xls', '.docx', '.doc',
  '.csv', '.txt', '.zip', '.rvt', '.ifc',
]);

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(projectId: string, category?: DocumentCategory, search?: string) {
    return this.prisma.document.findMany({
      where: {
        projectId,
        ...(category && { category }),
        ...(search && { title: { contains: search, mode: 'insensitive' } }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async register(projectId: string, file: Express.Multer.File, meta: any, userId?: string) {
    return this.prisma.document.create({
      data: {
        projectId,
        category: meta.category ?? 'OTHER',
        title: meta.title ?? file.originalname,
        description: meta.description,
        fileName: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedById: userId,
      },
    });
  }

  get(id: string) {
    return this.prisma.document.findUniqueOrThrow({ where: { id } });
  }

  async remove(id: string) {
    await this.prisma.document.delete({ where: { id } });
    return { success: true };
  }

  // ---- Drawing register ----
  listDrawings(projectId: string) {
    return this.prisma.drawing.findMany({ where: { projectId }, orderBy: [{ number: 'asc' }, { revision: 'desc' }] });
  }
  createDrawing(projectId: string, dto: any) {
    return this.prisma.drawing.create({ data: { ...dto, projectId } });
  }
  updateDrawing(id: string, dto: any) {
    return this.prisma.drawing.update({ where: { id }, data: dto });
  }

  // ---- RFIs ----
  listRfis(projectId: string) {
    return this.prisma.rfi.findMany({ where: { projectId }, orderBy: { raisedAt: 'desc' } });
  }
  async createRfi(projectId: string, dto: any, userId?: string) {
    const count = await this.prisma.rfi.count({ where: { projectId } });
    return this.prisma.rfi.create({
      data: {
        ...dto, projectId, raisedById: userId,
        number: dto.number ?? `RFI-${String(count + 1).padStart(3, '0')}`,
        raisedAt: dto.raisedAt ?? new Date(),
      },
    });
  }
  answerRfi(id: string, answer: string) {
    return this.prisma.rfi.update({
      where: { id },
      data: { answer, answeredAt: new Date(), status: 'ANSWERED' },
    });
  }
  updateRfi(id: string, dto: any) {
    return this.prisma.rfi.update({ where: { id }, data: dto });
  }

  // ---- Submittals ----
  listSubmittals(projectId: string) {
    return this.prisma.submittal.findMany({ where: { projectId }, orderBy: { number: 'asc' } });
  }
  async createSubmittal(projectId: string, dto: any) {
    const count = await this.prisma.submittal.count({ where: { projectId } });
    return this.prisma.submittal.create({
      data: { ...dto, projectId, number: dto.number ?? `SUB-${String(count + 1).padStart(3, '0')}` },
    });
  }
  updateSubmittal(id: string, dto: any) {
    const data = { ...dto };
    if (dto.status && dto.status !== 'DRAFT' && dto.status !== 'SUBMITTED' && !dto.respondedAt) {
      data.respondedAt = new Date();
    }
    return this.prisma.submittal.update({ where: { id }, data });
  }
}

@ApiTags('Documents (DMS / Drawings / RFIs / Submittals)')
@ApiBearerAuth()
@Controller()
export class DocumentsController {
  constructor(private readonly svc: DocumentsService) {}

  @Get('projects/:projectId/documents') @RequirePermission('documents', 'read')
  list(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('category') category?: DocumentCategory,
    @Query('search') search?: string,
  ) {
    return this.svc.list(projectId, category, search);
  }

  @Post('projects/:projectId/documents')
  @RequirePermission('documents', 'create')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string' },
        category: { type: 'string' },
        description: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
          cb(null, UPLOAD_DIR);
        },
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
      }),
      limits: { fileSize: (Number(process.env.MAX_UPLOAD_SIZE_MB) || 25) * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!ALLOWED_EXT.has(ext)) return cb(new BadRequestException(`File type ${ext} not allowed`), false);
        cb(null, true);
      },
    }),
  )
  upload(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() meta: any,
    @CurrentUser('id') userId: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.svc.register(projectId, file, meta, userId);
  }

  @Get('documents/:id/download') @RequirePermission('documents', 'read')
  async download(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const doc = await this.svc.get(id);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.fileName)}"`);
    if (doc.mimeType) res.setHeader('Content-Type', doc.mimeType);
    createReadStream(join(doc.filePath)).pipe(res);
  }

  @Delete('documents/:id') @RequirePermission('documents', 'delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(id);
  }

  // Drawings
  @Get('projects/:projectId/drawings') @RequirePermission('documents', 'read')
  listDrawings(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.listDrawings(projectId);
  }
  @Post('projects/:projectId/drawings') @RequirePermission('documents', 'create')
  createDrawing(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: any) {
    return this.svc.createDrawing(projectId, dto);
  }
  @Patch('drawings/:id') @RequirePermission('documents', 'update')
  updateDrawing(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.svc.updateDrawing(id, dto);
  }

  // RFIs
  @Get('projects/:projectId/rfis') @RequirePermission('documents', 'read')
  listRfis(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.listRfis(projectId);
  }
  @Post('projects/:projectId/rfis') @RequirePermission('documents', 'create')
  createRfi(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: any,
    @CurrentUser('id') userId: string,
  ) {
    return this.svc.createRfi(projectId, dto, userId);
  }
  @Post('rfis/:id/answer') @RequirePermission('documents', 'update')
  answerRfi(@Param('id', ParseUUIDPipe) id: string, @Body() body: { answer: string }) {
    return this.svc.answerRfi(id, body.answer);
  }
  @Patch('rfis/:id') @RequirePermission('documents', 'update')
  updateRfi(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.svc.updateRfi(id, dto);
  }

  // Submittals
  @Get('projects/:projectId/submittals') @RequirePermission('documents', 'read')
  listSubmittals(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.svc.listSubmittals(projectId);
  }
  @Post('projects/:projectId/submittals') @RequirePermission('documents', 'create')
  createSubmittal(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: any) {
    return this.svc.createSubmittal(projectId, dto);
  }
  @Patch('submittals/:id') @RequirePermission('documents', 'update')
  updateSubmittal(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.svc.updateSubmittal(id, dto);
  }
}

@Module({ controllers: [DocumentsController], providers: [DocumentsService] })
export class DocumentsModule {}
