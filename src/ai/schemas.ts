import { z } from 'zod';

export const InvoiceItemExtractionSchema = z.object({
  rawName: z.string().min(1, 'Raw product name is required'),
  normalizedNameSuggestion: z.string().nullable().default(null),
  quantity: z.number().nullable().default(null),
  unit: z.string().nullable().default(null),
  unitPrice: z.number().nullable().default(null), // in Rupees float or null
  lineTotal: z.number().nullable().default(null),
  confidence: z.number().min(0).max(1).default(1.0),
  notes: z.string().nullable().default(null)
});

export const InvoiceExtractionSchema = z.object({
  supplierName: z.string().nullable().default(null),
  invoiceNumber: z.string().nullable().default(null),
  invoiceDate: z.string().nullable().default(null),
  currency: z.literal('INR').nullable().default('INR'),
  subtotal: z.number().nullable().default(null),
  tax: z.number().nullable().default(null),
  total: z.number().nullable().default(null),
  items: z.array(InvoiceItemExtractionSchema).default([]),
  overallConfidence: z.number().min(0).max(1).default(0.9),
  warnings: z.array(z.string()).default([])
});

export type InvoiceItemExtraction = z.infer<typeof InvoiceItemExtractionSchema>;
export type InvoiceExtraction = z.infer<typeof InvoiceExtractionSchema>;

export const ProductMatchSchema = z.object({
  matchedProductId: z.string().nullable().default(null),
  confidence: z.number().min(0).max(1).default(0.5),
  reason: z.string().default('Matched based on name similarity')
});

export type ProductMatchAIResult = z.infer<typeof ProductMatchSchema>;

export const AssistantProposalSchema = z.object({
  type: z.enum(['stock_adjustment', 'create_product']),
  productId: z.string().optional(),
  productName: z.string().optional(),
  quantity: z.number().optional(),
  direction: z.enum(['in', 'out']).optional(),
  transactionType: z.enum([
    'PURCHASE', 'SALE', 'RETURN_IN', 'RETURN_OUT',
    'ADJUSTMENT', 'DAMAGE', 'TRANSFER_IN', 'TRANSFER_OUT', 'OPENING_BALANCE'
  ]).optional(),
  unitCostPaise: z.number().optional(),
  reason: z.string().optional()
});

export const AssistantResponseSchema = z.object({
  answer: z.string().min(1),
  language: z.enum(['english', 'hindi', 'hinglish']).default('hinglish'),
  intent: z.enum(['query_stock', 'query_reorder', 'query_history', 'query_price', 'propose_adjustment', 'general_greeting', 'unknown']),
  proposal: AssistantProposalSchema.nullable().default(null)
});

export type AssistantAIResponse = z.infer<typeof AssistantResponseSchema>;
