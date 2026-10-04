import { describe, it, expect } from 'vitest';
import { InvoiceExtractionSchema, InvoiceItemExtractionSchema } from '../../src/ai/schemas';

describe('Invoice Extraction Schema Validation', () => {
  it('should accept valid structured invoice extraction', () => {
    const validData = {
      supplierName: 'ABC Electronics',
      invoiceNumber: 'INV-1042',
      invoiceDate: '2026-10-04',
      currency: 'INR',
      subtotal: 420.0,
      tax: 75.6,
      total: 495.6,
      items: [
        {
          rawName: '1K RESISTOR 0.25W',
          normalizedNameSuggestion: '1K Resistor',
          quantity: 50,
          unit: 'pcs',
          unitPrice: 2.4,
          lineTotal: 120.0,
          confidence: 0.98,
          notes: null
        }
      ],
      overallConfidence: 0.95,
      warnings: []
    };

    const parsed = InvoiceExtractionSchema.parse(validData);
    expect(parsed.supplierName).toBe('ABC Electronics');
    expect(parsed.items[0].quantity).toBe(50);
    expect(parsed.items[0].unitPrice).toBe(2.4);
  });

  it('should preserve nulls for missing values and never coerce to zero', () => {
    const partialData = {
      supplierName: null,
      invoiceNumber: null,
      invoiceDate: null,
      currency: 'INR',
      subtotal: null,
      tax: null,
      total: null,
      items: [
        {
          rawName: 'UNKNOWN ITEM',
          normalizedNameSuggestion: null,
          quantity: null,
          unit: null,
          unitPrice: null,
          lineTotal: null,
          confidence: 0.4,
          notes: 'Illegible line'
        }
      ],
      overallConfidence: 0.5,
      warnings: ['Supplier name was not found']
    };

    const parsed = InvoiceExtractionSchema.parse(partialData);
    expect(parsed.supplierName).toBeNull();
    expect(parsed.items[0].quantity).toBeNull();
    expect(parsed.items[0].unitPrice).toBeNull();
  });

  it('should reject invalid item missing rawName', () => {
    const invalidItem = {
      rawName: '',
      quantity: 10
    };

    expect(() => InvoiceItemExtractionSchema.parse(invalidItem)).toThrow();
  });

  it('should reject confidence values out of [0, 1] range', () => {
    const invalidItem = {
      rawName: 'LED 5mm',
      confidence: 1.5 // > 1.0
    };

    expect(() => InvoiceItemExtractionSchema.parse(invalidItem)).toThrow();
  });
});
