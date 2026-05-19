import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env file from the service or the monorepo root
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().url({ message: "DATABASE_URL must be a valid PostgreSQL connection string" }),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  SOMNIA_RPC_URL: z.string().url().default('https://rpc.somnia.network'),
  SOMNIA_WS_URL: z.string().url().default('wss://rpc.somnia.network'),
  TASK_FACTORY_ADDRESS: z.string().default('0x0000000000000000000000000000000000000000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
