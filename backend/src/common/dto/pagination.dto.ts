import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PaginationDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 25, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 25;

  @ApiPropertyOptional({ description: 'Free-text search' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Sort field' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; pageSize: number; pageCount: number };
}

export function paginate<T>(data: T[], total: number, dto: PaginationDto): Paginated<T> {
  const page = dto.page ?? 1;
  const pageSize = dto.pageSize ?? 25;
  return { data, meta: { total, page, pageSize, pageCount: Math.ceil(total / pageSize) } };
}

export function pageArgs(dto: PaginationDto) {
  const page = dto.page ?? 1;
  const pageSize = dto.pageSize ?? 25;
  return { skip: (page - 1) * pageSize, take: pageSize };
}
