import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsDate, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min,
  ValidateNested,
} from 'class-validator';
import { ConstraintType, DependencyType, TaskPriority, TaskStatus } from '@prisma/client';

export class CreateWbsNodeDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() parentId?: string;
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nameAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nameFr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phase?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}
export class UpdateWbsNodeDto extends PartialType(CreateWbsNodeDto) {}

export class CreateDependencyDto {
  @ApiProperty() @IsUUID() predecessorId: string;
  @ApiPropertyOptional({ enum: DependencyType, default: 'FS' })
  @IsOptional() @IsEnum(DependencyType) type?: DependencyType;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt() lagDays?: number;
}

export class CreateTaskDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nameAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nameFr?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() wbsNodeId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phase?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() responsibleId?: string;
  @ApiPropertyOptional({ enum: TaskPriority }) @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @ApiPropertyOptional({ enum: TaskStatus }) @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  @ApiPropertyOptional({ enum: ConstraintType }) @IsOptional() @IsEnum(ConstraintType) constraintType?: ConstraintType;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() constraintDate?: Date;
  @ApiProperty() @Type(() => Date) @IsDate() plannedStart: Date;
  @ApiProperty() @Type(() => Date) @IsDate() plannedFinish: Date;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) durationDays?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) budget?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isSummary?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isMilestone?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional({ type: [CreateDependencyDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateDependencyDto)
  dependencies?: CreateDependencyDto[];
}

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(1) progressPct?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() actualStart?: Date;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() actualFinish?: Date;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) actualCost?: number;
}

export class ProgressUpdateDto {
  @ApiProperty({ minimum: 0, maximum: 1 }) @IsNumber() @Min(0) @Max(1) progressPct: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() date?: Date;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

export class SaveBaselineDto {
  @ApiProperty({ example: 'Baseline Rev 1' }) @IsString() name: string;
}

export class SetAllocationDto {
  @ApiProperty() @IsUUID() employeeId: string;
  @ApiProperty() @IsInt() year: number;
  @ApiProperty() @IsInt() @Min(1) @Max(12) month: number;
  @ApiProperty({ minimum: 0, maximum: 2 }) @IsNumber() @Min(0) @Max(2) utilizationPct: number;
}
