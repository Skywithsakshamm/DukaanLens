import crypto from 'node:crypto';
import { DatabaseSync, getDb, runTransaction } from '../../database/connection';
import { AssistantProposal, AssistantMessage, TransactionType } from '../../shared/types';
import { ShopRow, AiProposalRow } from '../../database/types';
import { ProductService, productService } from '../products/product.service';
import { InventoryService, inventoryService } from '../inventory/inventory.service';
import { InvoiceService, invoiceService } from '../invoices/invoice.service';
import { ReorderService, reorderService } from '../reorder/reorder.service';
import { AuditService, auditService as defaultAuditService } from '../audit/audit.service';
import { getAiProvider, ShopInventoryContext } from '../../ai';

export class AssistantService {
  private productService: ProductService;
  private inventoryService: InventoryService;
  private invoiceService: InvoiceService;
  private reorderService: ReorderService;
  private auditService: AuditService;

  constructor(
    private db: DatabaseSync = getDb(),
    prodService?: ProductService,
    invService?: InventoryService,
    invcService?: InvoiceService,
    reordService?: ReorderService,
    auditServ?: AuditService
  ) {
    this.productService = prodService || new ProductService(db);
    this.inventoryService = invService || new InventoryService(db);
    this.invoiceService = invcService || new InvoiceService(db, this.productService, this.inventoryService);
    this.reorderService = reordService || new ReorderService(db, this.productService);
    this.auditService = auditServ || (db === getDb() ? defaultAuditService : new AuditService(db));
  }

  private assembleContext(): ShopInventoryContext {
    const shop = this.db.prepare('SELECT * FROM shop LIMIT 1').get() as unknown as ShopRow | undefined;
    const allProducts = this.productService.getAllProducts({ activeOnly: true });
    const lowStock = this.reorderService.getLowStockRecommendations('all');
    const { transactions } = this.inventoryService.getTransactions({ limit: 15 });
    const invoices = this.invoiceService.getAllInvoices(10);

    return {
      shopName: shop ? shop.name : 'DukaanLens Shop',
      products: allProducts.map(p => ({
        id: p.id,
        name: p.name,
        currentStock: p.currentStock,
        minimumStock: p.minimumStock,
        reorderQuantity: p.reorderQuantity,
        purchasePricePaise: p.purchasePricePaise,
        sellingPricePaise: p.sellingPricePaise,
        supplierName: p.supplierName,
        category: p.category,
        isLowStock: p.currentStock <= p.minimumStock
      })),
      lowStockCount: lowStock.length,
      recentTransactions: transactions.map(t => ({
        productName: t.productName || 'Product',
        type: t.type,
        quantity: t.quantity,
        date: t.createdAt
      })),
      recentInvoices: invoices.map(i => ({
        supplierName: i.supplierName,
        invoiceNumber: i.invoiceNumber,
        totalPaise: i.totalPaise,
        date: i.invoiceDate
      }))
    };
  }

  public async query(prompt: string, userId = 'user'): Promise<AssistantMessage> {
    if (!prompt || !prompt.trim()) {
      throw new Error('Query text is required.');
    }

    const context = this.assembleContext();
    const aiProvider = getAiProvider();
    const aiResponse = await aiProvider.answerInventoryQuestion(prompt.trim(), context);

    let attachedProposal: AssistantProposal | undefined = undefined;

    // If AI proposed a mutation, persist it safely in ai_proposals awaiting explicit user approval
    if (aiResponse.proposal && typeof aiResponse.proposal.productId === 'string') {
      const p = aiResponse.proposal;
      const prodId: string = aiResponse.proposal.productId;
      const product = this.productService.getProductById(prodId);

      if (product) {
        const proposalId = crypto.randomUUID();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString(); // 10 minutes
        const qty = Math.abs(p.quantity || 1);
        const direction = p.direction || (p.transactionType === 'SALE' ? 'out' : 'in');
        const newStock = direction === 'in' ? product.currentStock + qty : Math.max(0, product.currentStock - qty);

        const proposalPayload = {
          type: p.type,
          productId: product.id,
          productName: product.name,
          currentStock: product.currentStock,
          quantity: qty,
          direction,
          transactionType: p.transactionType || (direction === 'in' ? 'PURCHASE' : 'SALE'),
          newStock,
          unitCostPaise: p.unitCostPaise || product.purchasePricePaise,
          reason: p.reason || `Assistant mutation proposal requested by ${userId}`
        };

        this.db.prepare(`
          INSERT INTO ai_proposals (id, type, payload, status, created_by, expires_at, created_at)
          VALUES (?, ?, ?, 'pending', ?, ?, ?)
        `).run(
          proposalId,
          p.type,
          JSON.stringify(proposalPayload),
          userId,
          expiresAt,
          now.toISOString()
        );

        attachedProposal = {
          proposalId,
          type: p.type,
          productId: product.id,
          productName: product.name,
          currentStock: product.currentStock,
          quantity: qty,
          direction,
          transactionType: proposalPayload.transactionType as TransactionType,
          newStock,
          reason: proposalPayload.reason,
          expiresAt,
          status: 'pending'
        };
      }
    }

    return {
      id: crypto.randomUUID(),
      sender: 'assistant',
      text: aiResponse.answer,
      language: aiResponse.language,
      timestamp: new Date().toISOString(),
      proposal: attachedProposal
    };
  }

  /**
   * NON-NEGOTIABLE PROPOSAL APPROVAL:
   * Only mutates inventory upon explicit human approval.
   */
  public confirmProposal(proposalId: string, actor = 'user'): { success: boolean; message: string; transaction: any } {
    const row = this.db.prepare(`
      SELECT * FROM ai_proposals WHERE id = ?
    `).get(proposalId) as unknown as AiProposalRow | undefined;

    if (!row) {
      throw new Error(`Proposal with ID ${proposalId} not found.`);
    }

    if (row.status === 'confirmed') {
      throw new Error('This proposal has already been confirmed.');
    }

    if (row.status === 'rejected') {
      throw new Error('This proposal was previously cancelled.');
    }

    if (new Date(row.expires_at) < new Date()) {
      throw new Error('This proposal has expired. Please ask the assistant again.');
    }

    const payload = JSON.parse(row.payload);

    return runTransaction(this.db, () => {
      const transaction = this.inventoryService.adjustStock({
        productId: payload.productId,
        type: payload.transactionType || (payload.direction === 'in' ? 'PURCHASE' : 'SALE'),
        quantity: payload.quantity,
        unitCostPaise: payload.unitCostPaise,
        notes: payload.reason || 'Approved from AI Assistant proposal',
        createdBy: actor
      });

      this.db.prepare(`
        UPDATE ai_proposals SET status = 'confirmed' WHERE id = ?
      `).run(proposalId);

      this.auditService.log({
        actor,
        action: 'AI_PROPOSAL_CONFIRMED',
        entity: 'ai_proposals',
        entityId: proposalId,
        afterState: payload
      });

      const updatedProduct = this.productService.getProductById(payload.productId);

      return {
        success: true,
        message: `Successfully updated stock for ${payload.productName}. New current stock is ${updatedProduct?.currentStock ?? payload.newStock}.`,
        transaction
      };
    });
  }

  public rejectProposal(proposalId: string, actor = 'user'): { success: boolean; message: string } {
    const row = this.db.prepare('SELECT id, status FROM ai_proposals WHERE id = ?').get(proposalId) as { id: string; status: string } | undefined;
    if (!row) throw new Error('Proposal not found');

    this.db.prepare("UPDATE ai_proposals SET status = 'rejected' WHERE id = ?").run(proposalId);

    this.auditService.log({
      actor,
      action: 'AI_PROPOSAL_REJECTED',
      entity: 'ai_proposals',
      entityId: proposalId
    });

    return {
      success: true,
      message: 'Proposal cancelled. No stock changes were made.'
    };
  }
}

export const assistantService = new AssistantService();
