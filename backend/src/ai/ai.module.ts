import { Module } from '@nestjs/common';
import { AiParserService } from './ai-parser.service.js';

@Module({
  providers: [AiParserService],
  exports: [AiParserService],
})
export class AiModule {}
