import { Module } from '@nestjs/common';
import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@ApiTags('Company Settings')
@ApiBearerAuth()
@Controller('company')
export class CompaniesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  get(@CurrentUser('companyId') companyId: string) {
    return this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  }

  @Patch()
  @RequirePermission('settings', 'update')
  update(@CurrentUser('companyId') companyId: string, @Body() dto: Record<string, any>) {
    const allowed = ['name','nameAr','nameFr','legalName','registrationNo','taxNumber','address','city',
      'country','phone','email','website','logoUrl','baseCurrency','vatRate','fiscalYearStart'];
    const data = Object.fromEntries(Object.entries(dto).filter(([k]) => allowed.includes(k)));
    return this.prisma.company.update({ where: { id: companyId }, data });
  }

  @Get('settings')
  listSettings(@CurrentUser('companyId') companyId: string) {
    return this.prisma.setting.findMany({ where: { companyId } });
  }
}

@Module({ controllers: [CompaniesController] })
export class CompaniesModule {}
