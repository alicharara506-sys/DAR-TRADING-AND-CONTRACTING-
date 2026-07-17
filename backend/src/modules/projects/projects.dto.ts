import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { MilestoneStatus, ProjectStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateProjectDto {
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nameAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nameFr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() clientId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() consultantId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contractNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() location?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional({ enum: ProjectStatus }) @IsOptional() @IsEnum(ProjectStatus) status?: ProjectStatus;
  @ApiProperty() @Type(() => Date) @IsDate() startDate: Date;
  @ApiProperty() @Type(() => Date) @IsDate() finishDate: Date;
  @ApiPropertyOptional() @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) contractValue?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() vatRate?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() retentionRate?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() advanceRate?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() directCost?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() indirectCost?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() contingency?: number;
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}

export class QueryProjectsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ProjectStatus }) @IsOptional() @IsEnum(ProjectStatus) status?: ProjectStatus;
}

export class CreateMilestoneDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @Type(() => Date) @IsDate() targetDate: Date;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() actualDate?: Date;
  @ApiPropertyOptional() @IsOptional() @IsNumber() progressPct?: number;
  @ApiPropertyOptional({ enum: MilestoneStatus }) @IsOptional() @IsEnum(MilestoneStatus) status?: MilestoneStatus;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}

export class UpdateMilestoneDto extends PartialType(CreateMilestoneDto) {}

export class AddMemberDto {
  @ApiProperty() @IsUUID() userId: string;
  @ApiProperty() @IsString() role: string;
}
