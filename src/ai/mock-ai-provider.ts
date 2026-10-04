import { AiProvider, ProductCandidate, ShopInventoryContext } from './ai-provider.interface';
import {
  InvoiceExtraction,
  ProductMatchAIResult,
  AssistantAIResponse
} from './schemas';
import { calculateTokenSimilarity, normalizeProductName } from '../shared/formatters';

export class MockAiProvider implements AiProvider {
  private modelName: string;

  constructor(modelName = 'gemma-4-26b-a4b-it (Mock)') {
    this.modelName = modelName;
  }

  public isConfigured(): boolean {
    return true;
  }

  public getModelName(): string {
    return this.modelName;
  }

  public checkDirectAudioSupport(): boolean {
    return false;
  }

  public async extractInvoice(_imageBuffer: Buffer, _mimeType: string): Promise<InvoiceExtraction> {
    // Realistic simulated extraction from standard electronics/kirana invoice
    return {
      supplierName: 'ABC Electronics',
      invoiceNumber: 'INV-1043',
      invoiceDate: '2026-10-04',
      currency: 'INR',
      subtotal: 390.0,
      tax: 70.2,
      total: 460.2,
      items: [
        {
          rawName: '1K RES 0.25W',
          normalizedNameSuggestion: '1K Resistor',
          quantity: 50,
          unit: 'pcs',
          unitPrice: 2.4,
          lineTotal: 120.0,
          confidence: 0.96,
          notes: 'Standard 1/4 watt resistor pack'
        },
        {
          rawName: '10UF 50V CAP',
          normalizedNameSuggestion: '10uF Capacitor',
          quantity: 30,
          unit: 'pcs',
          unitPrice: 6.0,
          lineTotal: 180.0,
          confidence: 0.94,
          notes: 'Keltron radial capacitor'
        },
        {
          rawName: 'LED 5MM RED',
          normalizedNameSuggestion: 'LED 5mm Red',
          quantity: 100,
          unit: 'pcs',
          unitPrice: 2.5,
          lineTotal: 250.0,
          confidence: 0.98,
          notes: 'High brightness red LED'
        }
      ],
      overallConfidence: 0.96,
      warnings: []
    };
  }

  public async suggestProductMatch(
    rawName: string,
    candidates: ProductCandidate[]
  ): Promise<ProductMatchAIResult> {
    const normRaw = normalizeProductName(rawName);

    // 1. Check exact alias or name matches
    for (const cand of candidates) {
      if (normalizeProductName(cand.name) === normRaw) {
        return {
          matchedProductId: cand.id,
          confidence: 0.99,
          reason: 'Exact name match'
        };
      }
      for (const alias of cand.aliases) {
        if (normalizeProductName(alias) === normRaw) {
          return {
            matchedProductId: cand.id,
            confidence: 0.95,
            reason: `Matched alias "${alias}"`
          };
        }
      }
    }

    // 2. Check token similarity
    let bestCand: ProductCandidate | null = null;
    let highestSim = 0;

    for (const cand of candidates) {
      const sim = calculateTokenSimilarity(rawName, cand.name);
      if (sim > highestSim) {
        highestSim = sim;
        bestCand = cand;
      }
      for (const alias of cand.aliases) {
        const aSim = calculateTokenSimilarity(rawName, alias);
        if (aSim > highestSim) {
          highestSim = aSim;
          bestCand = cand;
        }
      }
    }

    if (bestCand && highestSim >= 0.4) {
      return {
        matchedProductId: bestCand.id,
        confidence: Math.min(0.9, highestSim + 0.2),
        reason: `Matched based on token similarity (${Math.round(highestSim * 100)}%)`
      };
    }

    return {
      matchedProductId: null,
      confidence: 0.0,
      reason: 'No matching product found in shop catalog'
    };
  }

  public async answerInventoryQuestion(
    query: string,
    context: ShopInventoryContext
  ): Promise<AssistantAIResponse> {
    const qLower = query.toLowerCase();

    // 1. Stock inquiry e.g. "1k resistor kitne bache", "stock check"
    const productMatch = context.products.find(p =>
      qLower.includes(p.name.toLowerCase()) ||
      p.name.toLowerCase().split(' ').some(t => t.length > 2 && qLower.includes(t))
    );

    // 2. Low stock inquiry e.g. "kya mangwana hai", "low stock"
    if (
      qLower.includes('mangwana') ||
      qLower.includes('reorder') ||
      qLower.includes('order') ||
      qLower.includes('low stock') ||
      qLower.includes('kam stock')
    ) {
      const lowItems = context.products.filter(p => p.isLowStock);
      if (lowItems.length === 0) {
        return {
          answer: 'Sabhi products ka stock theek hai! Abhi koi bhi product low stock nahi hai.',
          language: 'hinglish',
          intent: 'query_reorder',
          proposal: null
        };
      }
      const listStr = lowItems
        .map(p => `• ${p.name}: Current stock ${p.currentStock} (Min: ${p.minimumStock}), Reorder: ${p.reorderQuantity} pcs`)
        .join('\n');

      return {
        answer: `Shop mein ${lowItems.length} products low stock par hain:\n\n${listStr}\n\nKya inka purchase order create karna hai?`,
        language: 'hinglish',
        intent: 'query_reorder',
        proposal: null
      };
    }

    // 3. Stock mutation proposal e.g. "20 led add karo", "5 resistor becha"
    const isAdd = qLower.includes('add') || qLower.includes('aaya') || qLower.includes('daal');
    const isSale = qLower.includes('sale') || qLower.includes('becha') || qLower.includes('minus') || qLower.includes('remove');

    const qtyMatch = query.match(/\b(\d+)\b/);
    const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : null;

    if (productMatch && qty && (isAdd || isSale)) {
      const direction = isAdd ? 'in' : 'out';
      const txType = isAdd ? 'PURCHASE' : 'SALE';
      const newStock = direction === 'in' ? productMatch.currentStock + qty : Math.max(0, productMatch.currentStock - qty);

      return {
        answer: `Maine **${productMatch.name}** ke ${direction === 'in' ? '+' : '-'}${qty} units ka proposal taiyar kiya hai.\n\n• Current Stock: ${productMatch.currentStock}\n• Proposed Change: ${direction === 'in' ? '+' : '-'}${qty}\n• New Stock: ${newStock}\n\nKripya neeche button se **Confirm** karein.`,
        language: 'hinglish',
        intent: 'propose_adjustment',
        proposal: {
          type: 'stock_adjustment',
          productId: productMatch.id,
          productName: productMatch.name,
          quantity: qty,
          direction: direction,
          transactionType: txType,
          reason: `Voice/Assistant request: ${query}`
        }
      };
    }

    if (productMatch) {
      return {
        answer: `**${productMatch.name}** ka current stock **${productMatch.currentStock}** hai (Minimum stock requirement: ${productMatch.minimumStock}). Purchase price ₹${(productMatch.purchasePricePaise / 100).toFixed(2)}, Selling price ₹${(productMatch.sellingPricePaise / 100).toFixed(2)}.`,
        language: 'hinglish',
        intent: 'query_stock',
        proposal: null
      };
    }

    // 4. Today activity
    if (qLower.includes('today') || qLower.includes('aaj') || qLower.includes('recent')) {
      return {
        answer: `Aaj shop mein total ${context.recentTransactions.length} stock transactions hue hain. Dashboard par live ledger update ho chuka hai.`,
        language: 'hinglish',
        intent: 'query_history',
        proposal: null
      };
    }

    // 5. Default
    return {
      answer: `Namaste! Main DukaanLens AI assistant hoon. Aap mujhse stock checking ("1K Resistor kitne bache?"), reorder recommendations ("Kya mangwana hai?"), ya stock update ("20 LED add karo") pooch sakte hain.`,
      language: 'hinglish',
      intent: 'general_greeting',
      proposal: null
    };
  }

  public async transcribeAudio(_audioBuffer: Buffer, _mimeType: string): Promise<string> {
    return '1K resistor kitne bache?';
  }
}
