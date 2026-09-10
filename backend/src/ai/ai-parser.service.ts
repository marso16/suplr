import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { Product } from '../entities/product.entity.js';

export interface ParsedItem {
  productNameRaw: string;
  quantity: number;
  unit: string;
  productId: number | null;
  notes: string | null;
}

export interface ParsedOrder {
  isOrder: boolean;
  confidence: 'high' | 'medium' | 'low';
  currency: 'USD' | 'LBP';
  language: 'en' | 'fr' | 'ar';
  items: ParsedItem[];
}

const EMPTY: ParsedOrder = { isOrder: false, confidence: 'low', currency: 'USD', language: 'en', items: [] };

@Injectable()
export class AiParserService {
  private readonly logger = new Logger(AiParserService.name);
  private readonly apiKey: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('GROQ_API_KEY', '');
  }

  async parseOrderMessage(text: string, products: Product[]): Promise<ParsedOrder> {
    if (!this.apiKey) { this.logger.warn('Groq API key not configured'); return EMPTY; }
    try {
      const catalog = products.map(p =>
        `- ID:${p.id} | ${p.name} | SKU:${p.sku} | unit:${p.unit}` +
        (p.priceUsd ? ` | price_usd:${p.priceUsd}` : '') +
        (p.priceLbp ? ` | price_lbp:${p.priceLbp}` : '')
      ).join('\n') || '(empty catalog — use product_id: null)';

      const systemPrompt = `You are an order extraction assistant for a B2B supplier. Extract structured order data from client WhatsApp messages.

SUPPLIER PRODUCT CATALOG:
${catalog}
Rules:
- If the message is an order, set is_order to true
- Match product_name_raw to catalog items when possible; set product_id to the matching ID or null
- quantity must be a number
- Detect the currency the client wants:
  - Set currency to "LBP" if the message contains: lira, lbp, ل.ل, ليرة, or large numbers typical for LBP
  - Set currency to "USD" for: dollar, usd, $, or by default
- If unsure whether this is an order, set confidence to "low"
- Detect the language: "ar" for Arabic, "fr" for French, "en" otherwise
- Respond ONLY with valid JSON:
{"is_order":boolean,"confidence":"high"|"medium"|"low","currency":"USD"|"LBP","language":"en"|"fr"|"ar","items":[{"product_name_raw":"string","product_id":integer|null,"quantity":number,"unit":"string","notes":"string|null"}]}`;

      const res = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'openai/gpt-oss-20b',
          temperature: 0,
          max_tokens: 500,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Client message: ${text}` },
          ],
        },
        {
          headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
          timeout: 15000,
        },
      );

      const content = res.data.choices[0].message.content as string;
      const data = JSON.parse(content) as Record<string, unknown>;
      const items = ((data.items as any[]) ?? []).map((i: any) => ({
        productNameRaw: String(i.product_name_raw ?? ''),
        quantity: Number(i.quantity ?? 0),
        unit: String(i.unit ?? 'unit'),
        productId: i.product_id != null ? Number(i.product_id) : null,
        notes: i.notes ? String(i.notes) : null,
      }));

      return {
        isOrder: Boolean(data.is_order),
        confidence: (data.confidence as 'high' | 'medium' | 'low') ?? 'low',
        currency: (data.currency as 'USD' | 'LBP') ?? 'USD',
        language: (data.language as 'en' | 'fr' | 'ar') ?? 'en',
        items,
      };
    } catch (e) {
      this.logger.warn(`AI parse failed: ${(e as Error).message}`);
      return EMPTY;
    }
  }
}
