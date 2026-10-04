import dotenv from 'dotenv';
import path from 'node:path';
import crypto from 'node:crypto';

// Load .env in non-production
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export interface AppConfig {
  nodeEnv: string;
  port: number;
  dataDir: string;
  sessionSecret: string;
  geminiApiKey: string | null;
  gemmaModel: string;
  mockAi: boolean;
  version: string;
}

const packageJson = require('../../package.json');

export const config: AppConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  dataDir: process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.resolve(process.cwd(), 'data'),
  sessionSecret: process.env.SESSION_SECRET || 'dukaanlens-default-secret-key-32-chars-long-!',
  geminiApiKey: process.env.GEMINI_API_KEY || null,
  gemmaModel: process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it',
  mockAi: process.env.MOCK_AI === 'true',
  version: packageJson.version || '1.0.0'
};

export function validateEnvironment(): void {
  if (config.nodeEnv === 'production') {
    if (!process.env.SESSION_SECRET) {
      console.warn('[SECURITY WARNING] SESSION_SECRET is not set in production. Using fallback secret.');
    }
    if (!config.geminiApiKey) {
      console.warn('[AI CONFIG WARNING] GEMINI_API_KEY is missing. Cloud Gemma AI features will be disabled or fallback.');
    }
  }
}
