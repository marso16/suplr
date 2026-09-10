import { Module } from '@nestjs/common';
import { SseController } from './sse.controller.js';
import { SseService } from './sse.service.js';

@Module({
  providers: [SseService],
  controllers: [SseController],
  exports: [SseService],
})
export class SseModule {}
