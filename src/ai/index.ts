import { AiProvider } from './ai-provider.interface';
import { GemmaGeminiProvider } from './gemma-gemini-provider';
import { MockAiProvider } from './mock-ai-provider';

let cachedProvider: AiProvider | null = null;

export function getAiProvider(forceNew = false): AiProvider {
  if (cachedProvider && !forceNew) {
    return cachedProvider;
  }

  const useMock =
    process.env.MOCK_AI === 'true' ||
    process.env.NODE_ENV === 'test' ||
    (!process.env.GEMINI_API_KEY && process.env.NODE_ENV !== 'production');

  if (useMock) {
    cachedProvider = new MockAiProvider();
    return cachedProvider;
  }

  cachedProvider = new GemmaGeminiProvider();
  return cachedProvider;
}

export * from './ai-provider.interface';
export * from './schemas';
export * from './prompts';
export * from './gemma-gemini-provider';
export * from './mock-ai-provider';
