export type Language = 'ar' | 'en';

export type CategoryId =
  | 'medicines'
  | 'vitamins'
  | 'devices'
  | 'skincare'
  | 'personal-care'
  | 'baby-care'
  | 'accessories'
  | 'first-aid'
  | 'dental-care'
  | 'hair-care';

export interface Category {
  id: CategoryId;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  image: string;
  iconName:
    | 'Pill'
    | 'Sparkles'
    | 'Activity'
    | 'Droplets'
    | 'HeartHandshake'
    | 'Baby'
    | 'Stethoscope'
    | 'Cross'
    | 'Smile'
    | 'Wind';
}

export interface ProductSpec {
  labelAr: string;
  labelEn: string;
  valueAr: string;
  valueEn: string;
}

export interface Product {
  id: string;
  sku: string;
  categoryId: CategoryId;
  nameAr: string;
  nameEn: string;
  shortDescAr: string;
  shortDescEn: string;
  descriptionAr: string;
  descriptionEn: string;
  brandAr: string;
  brandEn: string;
  price: number;
  originalPrice?: number;
  stockCount: number;
  image: string;
  isFeatured?: boolean;
  isBestSeller?: boolean;
  isNewArrival?: boolean;
  isOffer?: boolean;
  requiresPrescription?: boolean;
  specs: ProductSpec[];
  rating: number;
  reviewCount: number;
}

export interface PromoBanner {
  id: string;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  ctaAr: string;
  ctaEn: string;
  discountTextAr: string;
  discountTextEn: string;
  targetCategory?: CategoryId | 'offers';
  image: string;
  tone: 'blue' | 'sky';
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type PrescriptionStatus =
  | 'pending_review'
  | 'under_review'
  | 'approved'
  | 'needs_clarification'
  | 'rejected'
  | 'preparing'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'ready_for_delivery';

export type PrescriptionFileStatus = 'pending' | 'verified' | 'unclear';

export interface PrescriptionFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  fileType: 'image' | 'pdf';
  url: string;
  uploadedAt: string;
  verificationStatus: PrescriptionFileStatus;
  staffNote?: string;
}

export interface PrescriptionStatusEvent {
  status: PrescriptionStatus;
  timestamp: string;
  actor: string;
  note?: string;
}

export interface LinkedOrderItem {
  productId: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  quantity: number;
  price: number;
  requiresPrescription?: boolean;
}

export interface PrescriptionSubmission {
  id: string;
  linkedOrderNumber?: string;
  linkedItems?: LinkedOrderItem[];
  patientName: string;
  phone: string;
  address: string;
  notes: string;
  files: PrescriptionFile[];
  status: PrescriptionStatus;
  reviewedBy?: string;
  reviewNotes?: string;
  estimatedTotal?: number;
  submittedAt: string;
  updatedAt: string;
  statusHistory: PrescriptionStatusEvent[];
}

export interface OrderReceipt {
  orderNumber: string;
  customerName: string;
  phone: string;
  address: string;
  paymentMethod: 'cod' | 'card';
  items: CartItem[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  prescriptionId?: string;
  prescriptionStatus?: PrescriptionStatus;
  uploadedFilesCount?: number;
  pointsRedeemed?: number;
  pointsDiscount?: number;
  pointsEarned?: number;
  newPointsBalance?: number;
}

export type LoyaltyTier = 'silver' | 'gold' | 'platinum';

export type LoyaltyTransactionType = 'earned' | 'redeemed' | 'bonus';

export interface LoyaltyTransaction {
  id: string;
  type: LoyaltyTransactionType;
  points: number;
  egpValue: number;
  orderNumber?: string;
  descriptionAr: string;
  descriptionEn: string;
  createdAt: string;
}

export interface UserLoyaltyProfile {
  memberId: string;
  fullName: string;
  phone: string;
  address: string;
  pointsBalance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  ordersCount: number;
  transactions: LoyaltyTransaction[];
  updatedAt: string;
}

export interface PrescriptionAlert {
  id: string;
  rxId: string;
  patientName: string;
  previousStatus: PrescriptionStatus;
  newStatus: PrescriptionStatus;
  reviewNotes?: string;
  timestamp: string;
  read: boolean;
}

export type SortOption = 'featured' | 'best-selling' | 'price-asc' | 'price-desc' | 'newest';
export type PriceRangeFilter = 'all' | 'under-200' | '200-500' | 'over-500';

