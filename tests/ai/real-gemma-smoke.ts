import dotenv from 'dotenv';
dotenv.config();

import { GemmaGeminiProvider } from '../../src/ai/gemma-gemini-provider';

async function runRealSmokeTest() {
  console.log('--- DukaanLens Gemma 4 Real Smoke Test ---');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    console.log('[SMOKE TEST SKIPPED] GEMINI_API_KEY is not set in environment or .env.');
    console.log('To run real Gemma test: Set GEMINI_API_KEY=your_key and re-run.');
    return;
  }

  const model = process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it';
  console.log(`Testing live connectivity with model: ${model}`);

  const provider = new GemmaGeminiProvider();

  try {
    const dummyContext = {
      shopName: 'Test Shop',
      products: [
        {
          id: 'p-1',
          name: '1K Resistor',
          currentStock: 7,
          minimumStock: 20,
          reorderQuantity: 100,
          purchasePricePaise: 240,
          sellingPricePaise: 500,
          isLowStock: true
        }
      ],
      lowStockCount: 1,
      recentTransactions: [],
      recentInvoices: []
    };

    console.log('Sending live query to Google Gen AI API...');
    const result = await provider.answerInventoryQuestion('1K resistor kitne bache hain?', dummyContext);

    console.log('[SMOKE TEST SUCCESS] Connected to Gemma 4 Cloud!');
    console.log('Answer:', result.answer);
    console.log('Language:', result.language);
    console.log('Intent:', result.intent);
  } catch (err: any) {
    console.error('[SMOKE TEST FAILED]:', err.message);
  }
}

runRealSmokeTest();
