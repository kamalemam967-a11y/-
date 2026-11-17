import {
  LinkedOrderItem,
  PrescriptionFileStatus,
  PrescriptionStatus,
  PrescriptionSubmission,
} from '../types/pharmacy';

export interface UploadFilePayload {
  name: string;
  mimeType: string;
  size: number;
  base64Data: string;
}

export interface StagedUploadFile extends UploadFilePayload {
  localId: string;
  fileType: 'image' | 'pdf';
  previewUrl?: string;
}

export const MAX_FILES_PER_ORDER = 10;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const STAFF_TOKEN_KEY = 'mar_pharmacy_staff_token';
const STAFF_USER_KEY = 'mar_pharmacy_staff_user';

export interface StaffSessionInfo {
  token: string;
  pharmacistName: string;
}

export function getStoredStaffSession(): StaffSessionInfo | null {
  try {
    const token = sessionStorage.getItem(STAFF_TOKEN_KEY);
    const pharmacistName = sessionStorage.getItem(STAFF_USER_KEY);
    if (!token || !pharmacistName) return null;
    return { token, pharmacistName };
  } catch {
    return null;
  }
}

function saveStaffSession(session: StaffSessionInfo) {
  try {
    sessionStorage.setItem(STAFF_TOKEN_KEY, session.token);
    sessionStorage.setItem(STAFF_USER_KEY, session.pharmacistName);
  } catch {
    // ignore storage quota errors
  }
}

export function clearStaffSession() {
  try {
    sessionStorage.removeItem(STAFF_TOKEN_KEY);
    sessionStorage.removeItem(STAFF_USER_KEY);
  } catch {
    // ignore storage errors
  }
}

export async function loginStaffPortal(
  pharmacistName: string,
  passcode: string
): Promise<StaffSessionInfo> {
  const res = await fetch('/api/staff/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pharmacistName, passcode }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'UNAUTHORIZED');
  }
  const session: StaffSessionInfo = {
    token: data.token,
    pharmacistName: data.pharmacistName,
  };
  saveStaffSession(session);
  return session;
}

export async function verifyStaffSession(): Promise<StaffSessionInfo | null> {
  const stored = getStoredStaffSession();
  if (!stored) return null;
  try {
    const res = await fetch('/api/staff/session', {
      headers: { Authorization: `Bearer ${stored.token}` },
    });
    if (!res.ok) {
      clearStaffSession();
      return null;
    }
    return stored;
  } catch {
    return null;
  }
}

export async function logoutStaffPortal(): Promise<void> {
  const stored = getStoredStaffSession();
  clearStaffSession();
  if (!stored) return;
  try {
    await fetch('/api/staff/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${stored.token}` },
    });
  } catch {
    // ignore network errors during logout
  }
}
export const ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
];

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export async function fileToStagedUpload(file: File): Promise<StagedUploadFile> {
  const mimeType = (file.type || '').toLowerCase();
  const isPdf = mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const resolvedMime = isPdf ? 'application/pdf' : mimeType;

  if (!ACCEPTED_MIME_TYPES.includes(resolvedMime)) {
    throw new Error('UNSUPPORTED_FILE_TYPE');
  }
  if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('FILE_TOO_LARGE');
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('READ_FAILED'));
      }
    };
    reader.onerror = () => reject(new Error('READ_FAILED'));
    reader.readAsDataURL(file);
  });

  return {
    localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    mimeType: resolvedMime,
    size: file.size,
    base64Data: dataUrl,
    fileType: isPdf ? 'pdf' : 'image',
    previewUrl: isPdf ? undefined : dataUrl,
  };
}

function getVisitorId(): string {
  if (typeof window === 'undefined') return 'default-visitor';
  try {
    let id = localStorage.getItem('mar_pharmacy_visitor_id');
    if (!id) {
      id = `v-${crypto.randomUUID()}`;
      localStorage.setItem('mar_pharmacy_visitor_id', id);
    }
    return id;
  } catch {
    return 'default-visitor';
  }
}

export async function fetchPrescriptions(
  status?: PrescriptionStatus | 'all',
  query?: string
): Promise<PrescriptionSubmission[]> {
  const params = new URLSearchParams();
  if (status && status !== 'all') params.set('status', status);
  if (query && query.trim()) params.set('q', query.trim());
  const qs = params.toString();
  const res = await fetch(`/api/prescriptions${qs ? `?${qs}` : ''}`, {
    headers: { 'X-Visitor-Id': getVisitorId() },
  });
  if (!res.ok) {
    throw new Error('Failed to load prescriptions');
  }
  return (await res.json()) as PrescriptionSubmission[];
}

export async function createPrescriptionOrder(payload: {
  patientName: string;
  phone: string;
  address: string;
  notes?: string;
  linkedOrderNumber?: string;
  linkedItems?: LinkedOrderItem[];
  files: UploadFilePayload[];
}): Promise<PrescriptionSubmission> {
  const res = await fetch('/api/prescriptions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Visitor-Id': getVisitorId(),
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to submit prescription');
  }
  return data as PrescriptionSubmission;
}

export async function addFilesToPrescription(
  rxId: string,
  files: UploadFilePayload[]
): Promise<PrescriptionSubmission> {
  const res = await fetch(`/api/prescriptions/${encodeURIComponent(rxId)}/files`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Visitor-Id': getVisitorId(),
    },
    body: JSON.stringify({ files }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to upload additional files');
  }
  return data as PrescriptionSubmission;
}

export async function removePrescriptionFile(
  rxId: string,
  fileId: string
): Promise<PrescriptionSubmission> {
  const res = await fetch(
    `/api/prescriptions/${encodeURIComponent(rxId)}/files/${encodeURIComponent(fileId)}`,
    {
      method: 'DELETE',
      headers: { 'X-Visitor-Id': getVisitorId() },
    }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to remove file');
  }
  return data as PrescriptionSubmission;
}

export async function reviewPrescription(
  rxId: string,
  payload: {
    status?: PrescriptionStatus;
    reviewedBy?: string;
    reviewNotes?: string;
    estimatedTotal?: number | null;
    fileUpdates?: Array<{
      fileId: string;
      verificationStatus: PrescriptionFileStatus;
      staffNote?: string;
    }>;
  }
): Promise<PrescriptionSubmission> {
  const session = getStoredStaffSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }

  const res = await fetch(`/api/prescriptions/${encodeURIComponent(rxId)}/review`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (res.status === 401) {
    clearStaffSession();
    throw new Error('STAFF_AUTH_REQUIRED');
  }
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update prescription review');
  }
  return data as PrescriptionSubmission;
}
