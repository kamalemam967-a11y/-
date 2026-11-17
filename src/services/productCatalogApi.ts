import { CategoryId, Product } from '../types/pharmacy';
import { clearStaffSession, getStoredStaffSession } from './prescriptionApi';

export interface CreateCustomProductPayload {
  nameAr: string;
  nameEn?: string;
  brandAr?: string;
  brandEn?: string;
  categoryId: CategoryId;
  price: number;
  originalPrice?: number;
  stockCount: number;
  sku?: string;
  shortDescAr?: string;
  shortDescEn?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  requiresPrescription?: boolean;
  isOffer?: boolean;
  isFeatured?: boolean;
  imageBase64?: string;
}

export async function fetchCustomProducts(): Promise<Product[]> {
  const res = await fetch('/api/products/custom');
  if (!res.ok) {
    throw new Error('Failed to load custom products');
  }
  return (await res.json()) as Product[];
}

export async function createCustomProduct(
  payload: CreateCustomProductPayload
): Promise<Product> {
  const session = getStoredStaffSession();
  if (!session) {
    throw new Error('STAFF_AUTH_REQUIRED');
  }

  const res = await fetch('/api/products/custom', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 401) {
    clearStaffSession();
    throw new Error('STAFF_AUTH_REQUIRED');
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to add product');
  }

  return data as Product;
}

export async function deleteCustomProduct(productId: string): Promise<void> {
  const session = getStoredStaffSession();
  if (!session) {
    throw new Error('STAFF_AUTH_REQUIRED');
  }

  const res = await fetch(`/api/products/custom/${encodeURIComponent(productId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${session.token}`,
    },
  });

  if (res.status === 401) {
    clearStaffSession();
    throw new Error('STAFF_AUTH_REQUIRED');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to delete product');
  }
}
