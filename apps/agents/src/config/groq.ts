import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
dotenv.config();

const anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';

if (!anthropicApiKey || anthropicApiKey === 'mock-key' || anthropicApiKey.startsWith('mock-')) {
  throw new Error('[askGroq Config] Missing or invalid ANTHROPIC_API_KEY. Real AI mode is strictly enforced.');
}

export const groq = new Anthropic({
  apiKey: anthropicApiKey,
});

export async function askGroq(prompt: string, system: string = "You are a helpful AI.") {
  const response = await groq.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system,
    messages: [
      { role: "user", content: prompt }
    ],
  });

  return response.content[0]?.type === 'text' ? response.content[0].text : "";
}
