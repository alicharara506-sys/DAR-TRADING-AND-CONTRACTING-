import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class AskDto {
  @ApiProperty({ example: 'Which activities are delaying the project?' })
  @IsString()
  question: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() projectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() conversationId?: string;
}

@ApiTags('AI Project Assistant')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly svc: AiService) {}

  @Post('ask')
  @ApiOperation({
    summary:
      'Ask the AI assistant about live project data (delays, forecasts, CPI, cash flow, suppliers, risks, reports, profitability)',
  })
  ask(
    @CurrentUser('id') userId: string,
    @CurrentUser('companyId') companyId: string,
    @Body() dto: AskDto,
  ) {
    return this.svc.ask(userId, companyId, dto.question, {
      projectId: dto.projectId,
      conversationId: dto.conversationId,
    });
  }

  @Get('conversations')
  listConversations(@CurrentUser('id') userId: string) {
    return this.svc.listConversations(userId);
  }

  @Get('conversations/:id')
  getConversation(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getConversation(userId, id);
  }
}
