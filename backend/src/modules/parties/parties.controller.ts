import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PartiesService } from './parties.service';
import { CreatePartyDto, QueryPartiesDto, UpdatePartyDto } from './parties.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Directory (Clients / Consultants / Contractors / Suppliers)')
@ApiBearerAuth()
@Controller('parties')
export class PartiesController {
  constructor(private readonly parties: PartiesService) {}

  @Get()
  @RequirePermission('parties', 'read')
  findAll(@CurrentUser('companyId') companyId: string, @Query() dto: QueryPartiesDto) {
    return this.parties.findAll(companyId, dto);
  }

  @Get('supplier-performance')
  @RequirePermission('parties', 'read')
  supplierPerformance(@CurrentUser('companyId') companyId: string) {
    return this.parties.supplierPerformance(companyId);
  }

  @Get(':id')
  @RequirePermission('parties', 'read')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.parties.findOne(companyId, id);
  }

  @Post()
  @RequirePermission('parties', 'create')
  create(@CurrentUser('companyId') companyId: string, @Body() dto: CreatePartyDto) {
    return this.parties.create(companyId, dto);
  }

  @Patch(':id')
  @RequirePermission('parties', 'update')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePartyDto,
  ) {
    return this.parties.update(companyId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('parties', 'delete')
  remove(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.parties.remove(companyId, id);
  }
}
