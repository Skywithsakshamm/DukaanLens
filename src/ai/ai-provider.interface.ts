import { InvoiceExtraction, ProductMatchAIResult, AssistantAIResponse } from './schemas';

export interface ProductCandidate {
  id: string;
  name: string;
  sku?: string;
  category?: string;
  aliases: string[];
}

export interface ShopInventoryContext {
  shopName: string;
  products: Array<{
    id: string;
    name: string;
    currentStock: number;
    minimumStock: number;
    reorderQuantity: number;
    purchasePricePaise: number;
    sellingPricePaise: number;
    supplierName?: string;
    category?: string;
    isLowStock: boolean;
  }>;
  lowStockCount: number;
  recentTransactions: Array<{
    productName: string;
    type: string;
    quantity: number;
    date: string;
  }>;
  recentInvoices: Array<{
    supplierName?: string;
    invoiceNumber?: string;
    totalPaise: number;
    date?: string;
  }>;
}

export interface AiProvider {
  /**
   * Extract invoice details and line items from an image buffer
   */
  extractInvoice(imageBuffer: Buffer, mimeType: string): Promise<InvoiceExtraction>;

  /**
   * Semantically match a raw invoice line item to catalog products
   */
  suggestProductMatch(rawName: string, candidates: ProductCandidate[]): Promise<ProductMatchAIResult>;

  /**
   * Answer a natural language inventory question grounded in shop context
   */
  answerInventoryQuestion(query: string, context: ShopInventoryContext): Promise<AssistantAIResponse>;

  /**
   * Parse short audio into transcription/intent
   */
  transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string>;

  /**
   * Whether the current model/endpoint supports direct audio input
   */
  checkDirectAudioSupport(): boolean;

  /**
   * Returns configured model name (e.g. gemma-4-26b-a4b-it)
   */
  getModelName(): string;

  /**
   * Whether API credentials are validly configured
   */
  isConfigured(): boolean;
}
