import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

export class ClaudeService {
  private client: Anthropic;

  constructor() {
    const key = process.env.ANTHROPIC_API_KEY || '';
    if (!key || key === 'mock-key' || key.startsWith('mock-')) {
      throw new Error('[ClaudeService] Missing or invalid ANTHROPIC_API_KEY. Real AI mode is strictly enforced.');
    }
    this.client = new Anthropic({
      apiKey: key,
      maxRetries: 3,
      timeout: 30000, // 30s timeout
    });
  }

  async generateJSON<T>(
    prompt: string, 
    systemPrompt: string, 
    model: string = 'claude-sonnet-4-6'
  ): Promise<T> {
    logger.info(`[ClaudeService] Requesting JSON output from ${model}`);
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: `${systemPrompt}\n\nIMPORTANT: You must respond ONLY with valid raw JSON. Do not include markdown block formatting, markdown quotes, or any explanations. Return only the JSON object.`,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
    
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.substring(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.substring(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.substring(0, cleaned.length - 3);
    }
    cleaned = cleaned.trim();

    return JSON.parse(cleaned) as T;
  }

  async generateText(
    prompt: string, 
    systemPrompt: string, 
    model: string = 'claude-sonnet-4-6'
  ): Promise<string> {
    logger.info(`[ClaudeService] Requesting Text output from ${model}`);
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
    });

    return response.content[0]?.type === 'text' ? response.content[0].text : '';
  }

  async streamText(
    prompt: string, 
    systemPrompt: string, 
    onChunk: (chunk: string) => void,
    model: string = 'claude-sonnet-4-6'
  ): Promise<void> {
    logger.info(`[ClaudeService] Streaming from ${model}`);
    const stream = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        { role: 'user', content: prompt }
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        onChunk(chunk.delta.text);
      }
    }
  }
}

export const groqService = new ClaudeService();
