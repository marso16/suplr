import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class WhatsAppSenderService {
  private readonly logger = new Logger(WhatsAppSenderService.name);

  private headers(bspApiKey: string) {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${bspApiKey}` };
  }

  async sendMessage(bspEndpoint: string, bspApiKey: string, to: string, text: string, mediaUrl?: string): Promise<void> {
    const payload: Record<string, unknown> = { to, message: text };
    if (mediaUrl) payload.mediaUrl = mediaUrl;
    try {
      await axios.post(`${bspEndpoint.replace(/\/+$/, '')}/send`, payload, { headers: this.headers(bspApiKey), timeout: 10000 });
    } catch (e: any) {
      this.logger.error(`BSP send failed to ${to}: ${e.message}`);
      throw new Error(`BSP send failed: ${e.message}`);
    }
  }

  async sendDocument(bspEndpoint: string, bspApiKey: string, to: string, pdfBytes: Buffer, filename: string): Promise<void> {
    const payload = { to, filename, base64: pdfBytes.toString('base64') };
    try {
      await axios.post(`${bspEndpoint.replace(/\/+$/, '')}/send-document`, payload, { headers: this.headers(bspApiKey), timeout: 30000 });
    } catch (e: any) {
      this.logger.error(`BSP send-document failed to ${to}: ${e.message}`);
      throw new Error(`BSP send-document failed: ${e.message}`);
    }
  }

  async enqueueBroadcast(bspEndpoint: string, bspApiKey: string, numbers: string[], message: string, scheduledAt?: Date | null, mediaUrl?: string): Promise<string> {
    let delayMs = 0;
    if (scheduledAt) {
      delayMs = Math.max(0, (new Date(scheduledAt).getTime() - Date.now()));
    }
    const payload: Record<string, unknown> = { numbers, message, delayMs };
    if (mediaUrl) payload.mediaUrl = mediaUrl;
    try {
      const res = await axios.post(`${bspEndpoint.replace(/\/+$/, '')}/queue/broadcast`, payload, { headers: this.headers(bspApiKey), timeout: 10000 });
      return (res.data as any)?.jobId ?? '';
    } catch (e: any) {
      this.logger.error(`BSP enqueue-broadcast failed: ${e.message}`);
      throw new Error(`BSP enqueue-broadcast failed: ${e.message}`);
    }
  }
}
