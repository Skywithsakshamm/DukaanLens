import {
  User,
  Shop,
  Product,
  Supplier,
  Invoice,
  InvoiceItem,
  InventoryTransaction,
  ReorderItem,
  DashboardMetrics,
  AssistantMessage,
  TransactionType
} from '../../shared/types';

async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    credentials: 'include' // include cookies
  });

  const data = await res.json();
  if (!res.ok) {
    const errorMsg = data?.error?.message || `Request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }
  return data;
}

export const api = {
  // Auth
  auth: {
    login: (username: string, password: string) =>
      fetchJson<{ success: boolean; user: User; sessionId: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      }),
    me: () => fetchJson<{ user: User }>('/api/auth/me'),
    logout: () => fetchJson<{ success: boolean }>('/api/auth/logout', { method: 'POST' })
  },

  // Dashboard
  dashboard: {
    getMetrics: () => fetchJson<{ metrics: DashboardMetrics }>('/api/dashboard')
  },

  // Products
  products: {
    list: (params?: { search?: string; category?: string; supplierId?: string; lowStockOnly?: boolean; activeOnly?: boolean }) => {
      const query = new URLSearchParams();
      if (params?.search) query.set('search', params.search);
      if (params?.category) query.set('category', params.category);
      if (params?.supplierId) query.set('supplierId', params.supplierId);
      if (params?.lowStockOnly) query.set('lowStockOnly', 'true');
      if (params?.activeOnly) query.set('activeOnly', 'true');
      return fetchJson<{ products: Product[] }>(`/api/products?${query.toString()}`);
    },
    get: (id: string) => fetchJson<{ product: Product }>(`/api/products/${id}`),
    create: (data: Partial<Product> & { initialStock?: number }) =>
      fetchJson<{ product: Product }>('/api/products', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    update: (id: string, data: Partial<Product>) =>
      fetchJson<{ product: Product }>(`/api/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      })
  },

  // Inventory
  inventory: {
    summary: () => fetchJson<{ summary: any }>('/api/inventory'),
    transactions: (params?: { productId?: string; type?: string; limit?: number; offset?: number }) => {
      const query = new URLSearchParams();
      if (params?.productId) query.set('productId', params.productId);
      if (params?.type) query.set('type', params.type);
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.offset) query.set('offset', String(params.offset));
      return fetchJson<{ transactions: InventoryTransaction[]; total: number }>(`/api/inventory/transactions?${query.toString()}`);
    },
    adjust: (data: { productId: string; type: TransactionType; quantity: number; notes?: string; unitCostPaise?: number }) =>
      fetchJson<{ success: boolean; transaction: InventoryTransaction }>('/api/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify(data)
      })
  },

  // Suppliers
  suppliers: {
    list: () => fetchJson<{ suppliers: Supplier[] }>('/api/suppliers'),
    get: (id: string) => fetchJson<{ supplier: Supplier; suppliedProducts: Product[] }>(`/api/suppliers/${id}`),
    create: (data: Partial<Supplier>) =>
      fetchJson<{ supplier: Supplier }>('/api/suppliers', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    update: (id: string, data: Partial<Supplier>) =>
      fetchJson<{ supplier: Supplier }>(`/api/suppliers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      })
  },

  // Invoices
  invoices: {
    list: () => fetchJson<{ invoices: Invoice[] }>('/api/invoices'),
    get: (id: string) => fetchJson<{ invoice: Invoice }>(`/api/invoices/${id}`),
    extract: async (file: File) => {
      const formData = new FormData();
      formData.append('invoiceImage', file);

      const res = await fetch('/api/invoices/extract', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Invoice extraction failed.');
      }
      return data as { success: boolean; invoice: Invoice };
    },
    updateDetails: (id: string, data: { supplierId?: string; supplierNameRaw?: string; invoiceNumber?: string; invoiceDate?: string }) =>
      fetchJson<{ invoice: Invoice }>(`/api/invoices/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      }),
    updateItem: (invoiceId: string, itemId: string, data: { productId?: string; quantity?: number; unitPricePaise?: number; rawName?: string }) =>
      fetchJson<{ success: boolean; item: InvoiceItem; invoice: Invoice }>(`/api/invoices/${invoiceId}/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      }),
    confirm: (id: string) =>
      fetchJson<{ success: boolean; invoice: Invoice }>(`/api/invoices/${id}/confirm`, {
        method: 'POST'
      }),
    cancel: (id: string) =>
      fetchJson<{ success: boolean; invoice: Invoice }>(`/api/invoices/${id}/cancel`, {
        method: 'POST'
      })
  },

  // Reorder
  reorder: {
    getLowStock: (filter: 'all' | 'critical' | 'low_stock' = 'all') =>
      fetchJson<{ recommendations: ReorderItem[]; count: number }>(`/api/reorder/low-stock?filter=${filter}`)
  },

  // Assistant
  assistant: {
    query: (prompt: string) =>
      fetchJson<{ message: AssistantMessage }>('/api/assistant/query', {
        method: 'POST',
        body: JSON.stringify({ prompt })
      }),
    confirmProposal: (proposalId: string) =>
      fetchJson<{ success: boolean; message: string; transaction: any }>('/api/assistant/confirm-proposal', {
        method: 'POST',
        body: JSON.stringify({ proposalId })
      }),
    rejectProposal: (proposalId: string) =>
      fetchJson<{ success: boolean; message: string }>('/api/assistant/reject-proposal', {
        method: 'POST',
        body: JSON.stringify({ proposalId })
      })
  },

  // Settings
  settings: {
    get: () => fetchJson<{ settings: any }>('/api/settings'),
    updateShop: (data: Partial<Shop>) =>
      fetchJson<{ shop: Shop }>('/api/settings/shop', {
        method: 'PATCH',
        body: JSON.stringify(data)
      })
  }
};
