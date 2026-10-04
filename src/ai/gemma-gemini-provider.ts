import { GoogleGenAI } from '@google/genai';
import { AiProvider, ProductCandidate, ShopInventoryContext } from './ai-provider.interface';
import {
  InvoiceExtractionSchema,
  InvoiceExtraction,
  ProductMatchSchema,
  ProductMatchAIResult,
  AssistantResponseSchema,
  AssistantAIResponse
} from './schemas';
import {
  INVOICE_EXTRACTION_SYSTEM_PROMPT,
  PRODUCT_MATCHING_SYSTEM_PROMPT,
  INVENTORY_ASSISTANT_SYSTEM_PROMPT
} from './prompts';

export class GemmaGeminiProvider implements AiProvider {
  private client: GoogleGenAI | null = null;
  private modelName: string;
  private apiKey: string | null = null;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || null;
    this.modelName = process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it';

    if (this.apiKey) {
      this.client = new GoogleGenAI({ apiKey: this.apiKey });
    }
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0 && this.client);
  }

  public getModelName(): string {
    return this.modelName;
  }

  public checkDirectAudioSupport(): boolean {
    // Return true only if model and path are capable; otherwise fallback to Web Speech
    return false;
  }

  private ensureConfigured(): GoogleGenAI {
    if (!this.client || !this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY in environment variables.');
    }
    return this.client;
  }

  /**
   * Helper to execute model content generation with timeout and error sanitization
   */
  private async executeGenerate(params: {
    systemInstruction: string;
    parts: Array<any>;
    responseSchemaDescription?: string;
  }): Promise<string> {
    const ai = this.ensureConfigured();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await ai.models.generateContent({
        model: this.modelName,
        contents: [
          {
            role: 'user',
            parts: params.parts
          }
        ],
        config: {
          systemInstruction: params.systemInstruction,
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      });

      clearTimeout(timeout);

      const text = response.text || '';
      if (!text.trim()) {
        throw new Error('Empty response received from AI model.');
      }
      return text;
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        throw new Error('AI request timed out after 30 seconds. Please try again.');
      }
      // Sanitize error message to avoid leaking any secret or raw internals
      const message = err.message || 'AI service error';
      if (message.includes('API_KEY') || message.includes('apiKey')) {
        throw new Error('Authentication with AI provider failed. Check GEMINI_API_KEY.');
      }
      throw new Error(`AI processing failed: ${message}`);
    }
  }

  public async extractInvoice(imageBuffer: Buffer, mimeType: string): Promise<InvoiceExtraction> {
    const base64Data = imageBuffer.toString('base64');

    const promptText = `
Extract all invoice information from this image.
Return JSON matching the schema:
{
  "supplierName": string | null,
  "invoiceNumber": string | null,
  "invoiceDate": "YYYY-MM-DD" | null,
  "currency": "INR",
  "subtotal": number | null,
  "tax": number | null,
  "total": number | null,
  "items": [
    {
      "rawName": string,
      "normalizedNameSuggestion": string | null,
      "quantity": number | null,
      "unit": string | null,
      "unitPrice": number | null,
      "lineTotal": number | null,
      "confidence": number,
      "notes": string | null
    }
  ],
  "overallConfidence": number,
  "warnings": string[]
}
`;

    const rawJson = await this.executeGenerate({
      systemInstruction: INVOICE_EXTRACTION_SYSTEM_PROMPT,
      parts: [
        { text: promptText },
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        }
      ]
    });

    try {
      const parsed = JSON.parse(rawJson);
      const validated = InvoiceExtractionSchema.parse(parsed);
      return validated;
    } catch (parseError: any) {
      throw new Error(`AI returned invalid invoice schema: ${parseError.message}`);
    }
  }

  public async suggestProductMatch(
    rawName: string,
    candidates: ProductCandidate[]
  ): Promise<ProductMatchAIResult> {
    const candidatesSummary = candidates.map(c => ({
      id: c.id,
      name: c.name,
      sku: c.sku,
      category: c.category,
      aliases: c.aliases
    }));

    const promptText = `
Raw invoice item: "${rawName}"
Candidate products: ${JSON.stringify(candidatesSummary)}

Find the best matching product or return matchedProductId = null.
`;

    const rawJson = await this.executeGenerate({
      systemInstruction: PRODUCT_MATCHING_SYSTEM_PROMPT,
      parts: [{ text: promptText }]
    });

    try {
      const parsed = JSON.parse(rawJson);
      return ProductMatchSchema.parse(parsed);
    } catch {
      return {
        matchedProductId: null,
        confidence: 0.0,
        reason: 'Semantic match could not be determined'
      };
    }
  }

  public async answerInventoryQuestion(
    query: string,
    context: ShopInventoryContext
  ): Promise<AssistantAIResponse> {
    const contextData = {
      shopName: context.shopName,
      totalCatalogProducts: context.products.length,
      lowStockCount: context.lowStockCount,
      lowStockProducts: context.products.filter(p => p.isLowStock).map(p => ({
        id: p.id,
        name: p.name,
        currentStock: p.currentStock,
        minimumStock: p.minimumStock,
        recommendedOrder: p.reorderQuantity,
        purchasePrice: `₹${(p.purchasePricePaise / 100).toFixed(2)}`,
        supplier: p.supplierName
      })),
      allProductsSummary: context.products.map(p => ({
        id: p.id,
        name: p.name,
        currentStock: p.currentStock,
        minimumStock: p.minimumStock,
        purchasePrice: `₹${(p.purchasePricePaise / 100).toFixed(2)}`,
        sellingPrice: `₹${(p.sellingPricePaise / 100).toFixed(2)}`,
        supplier: p.supplierName
      })),
      recentTransactions: context.recentTransactions.slice(0, 10),
      recentInvoices: context.recentInvoices.slice(0, 5)
    };

    const promptText = `
USER QUERY: "${query}"

VERIFIED SHOP DATA CONTEXT:
${JSON.stringify(contextData, null, 2)}

Respond with JSON adhering to:
{
  "answer": "string (practical, natural, in user's language/Hinglish)",
  "language": "hinglish" | "hindi" | "english",
  "intent": "query_stock" | "query_reorder" | "query_history" | "query_price" | "propose_adjustment" | "general_greeting" | "unknown",
  "proposal": {
    "type": "stock_adjustment",
    "productId": string,
    "productName": string,
    "quantity": number,
    "direction": "in" | "out",
    "transactionType": "PURCHASE" | "SALE" | "ADJUSTMENT",
    "reason": string
  } | null
}
`;

    const rawJson = await this.executeGenerate({
      systemInstruction: INVENTORY_ASSISTANT_SYSTEM_PROMPT,
      parts: [{ text: promptText }]
    });

    try {
      const parsed = JSON.parse(rawJson);
      return AssistantResponseSchema.parse(parsed);
    } catch (err: any) {
      return {
        answer: 'Maaf kijiye, main aapke query ko process nahi kar paya. Kripya dobara poochhein.',
        language: 'hinglish',
        intent: 'unknown',
        proposal: null
      };
    }
  }

  public async transcribeAudio(_audioBuffer: Buffer, _mimeType: string): Promise<string> {
    throw new Error('Direct audio upload is not supported on this model. Please use browser speech recognition.');
  }
}
