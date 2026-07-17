import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { FinanceModule } from '../finance/finance.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { PartiesModule } from '../parties/parties.module';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [FinanceModule, SchedulingModule, PartiesModule, ReportsModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
