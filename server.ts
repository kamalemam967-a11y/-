import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type {
  CategoryId,
  LinkedOrderItem,
  LoyaltyTransaction,
  PrescriptionFile,
  PrescriptionFileStatus,
  PrescriptionStatus,
  PrescriptionSubmission,
  Product,
  UserLoyaltyProfile,
} from './src/types/pharmacy.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '.data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'prescriptions.json');
const LOYALTY_FILE = path.join(DATA_DIR, 'loyalty.json');
const CUSTOM_PRODUCTS_FILE = path.join(DATA_DIR, 'custom-products.json');

const CATEGORY_DEFAULT_IMAGES: Record<CategoryId, string> = {
  medicines: '/src/assets/images/cat_medicines_box_1794906026848.jpg',
  vitamins: '/src/assets/images/cat_vitamins_bottle_1794906027924.jpg',
  devices: '/src/assets/images/cat_medical_device_1794906028376.jpg',
  skincare: '/src/assets/images/cat_skincare_cream_1794906028379.jpg',
  'personal-care': '/src/assets/images/cat_hair_personal_care_1794906031361.jpg',
  'baby-care': '/src/assets/images/cat_baby_care_1794906030047.jpg',
  accessories: '/src/assets/images/cat_medical_device_1794906028376.jpg',
  'first-aid': '/src/assets/images/cat_first_aid_kit_1794906030957.jpg',
  'dental-care': '/src/assets/images/cat_dental_care_1794906030477.jpg',
  'hair-care': '/src/assets/images/cat_hair_personal_care_1794906031361.jpg',
};

const VALID_CATEGORY_IDS = new Set<CategoryId>(
  Object.keys(CATEGORY_DEFAULT_IMAGES) as CategoryId[]
);

const MAX_FILES_PER_ORDER = 10;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
]);

const VALID_ID_RE = /^[a-zA-Z0-9_-]+$/;
const VALID_STATUSES = new Set<PrescriptionStatus>([
  'pending_review',
  'under_review',
  'approved',
  'needs_clarification',
  'rejected',
  'preparing',
  'ready_for_pickup',
  'out_for_delivery',
  'ready_for_delivery',
]);

const sseClients = new Set<express.Response>();

function broadcastPrescriptionEvent(eventName: string, payload: unknown) {
  const frame = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(frame);
    } catch {
      sseClients.delete(client);
    }
  }
}

const STAFF_ALLOWED_NAME = (process.env.PHARMACY_STAFF_NAME || 'mohamed').trim().toLowerCase();
const STAFF_ALLOWED_CODE = (process.env.PHARMACY_STAFF_PASSCODE || '01149737685').trim();
const STAFF_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

interface StaffSession {
  pharmacistName: string;
  createdAt: number;
}

const staffSessions = new Map<string, StaffSession>();

function timingSafeTextEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hashB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function getBearerToken(req: express.Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  return token || null;
}

function getActiveStaffSession(req: express.Request): StaffSession | null {
  const token = getBearerToken(req);
  if (!token) return null;
  const session = staffSessions.get(token);
  if (!session) return null;
  if (Date.now() - session.createdAt > STAFF_SESSION_TTL_MS) {
    staffSessions.delete(token);
    return null;
  }
  return session;
}

interface StoredPrescriptionRecord extends PrescriptionSubmission {
  fileStorageNames: Record<string, string>;
}

interface IncomingUploadFile {
  name: string;
  mimeType: string;
  size: number;
  base64Data: string;
}

function ensureStorageDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function buildMinimalValidPdfBuffer(lines: string[]): Buffer {
  const escaped = lines.map((line) =>
    line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  );
  const textCommands = escaped
    .map((line, index) => {
      const y = 740 - index * 24;
      return `BT /F1 ${index === 0 ? 15 : 11} Tf 54 ${y} Td (${line}) Tj ET`;
    })
    .join('\n');

  const streamContent = `${textCommands}\n`;
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${Buffer.byteLength(streamContent, 'utf8')} >>\nstream\n${streamContent}endstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

function buildSampleRxSvgBuffer(patientName: string, rxItems: string[]): Buffer {
  const safePatient = patientName.replace(/[<>&"]/g, '');
  const itemsSvg = rxItems
    .map(
      (item, idx) =>
        `<text x="48" y="${180 + idx * 34}" font-family="Arial, sans-serif" font-size="16" fill="#0f172a">${idx + 1}. ${item.replace(/[<>&"]/g, '')}</text>`
    )
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="520" viewBox="0 0 760 520">
  <rect width="760" height="520" fill="#f8fafc"/>
  <rect x="24" y="24" width="712" height="472" rx="16" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <rect x="24" y="24" width="712" height="68" rx="16" fill="#1d4ed8"/>
  <text x="48" y="64" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#ffffff">CLINICAL MEDICAL PRESCRIPTION (Rx)</text>
  <text x="48" y="124" font-family="Arial, sans-serif" font-size="15" fill="#475569">Patient: ${safePatient}   |   Clinic: Mansoura Medical Center</text>
  <line x1="48" y1="142" x2="712" y2="142" stroke="#e2e8f0" stroke-width="1.5"/>
  ${itemsSvg}
  <line x1="48" y1="400" x2="712" y2="400" stroke="#e2e8f0" stroke-width="1.5"/>
  <text x="48" y="440" font-family="Arial, sans-serif" font-size="14" fill="#334155">Attending Physician: Dr. Karim El-Sayed (License #48291)</text>
  <text x="48" y="466" font-family="Arial, sans-serif" font-size="12" fill="#64748b">Valid for licensed pharmacy verification and dispensing</text>
</svg>`;
  return Buffer.from(svg, 'utf8');
}

function seedInitialDataIfNeeded(): StoredPrescriptionRecord[] {
  ensureStorageDirs();
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw) as StoredPrescriptionRecord[];
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // fall through to re-seed if file is corrupted
    }
  }

  const rx1Id = 'RX-2026-4102';
  const rx1Dir = path.join(UPLOADS_DIR, rx1Id);
  fs.mkdirSync(rx1Dir, { recursive: true });

  const file1Id = 'file-rx-4102-1';
  const file2Id = 'file-rx-4102-2';
  const svg1 = buildSampleRxSvgBuffer('Nourhan Mahmoud', [
    'Augmentin 1g Tablet - 1 tab every 12h for 7 days',
    'Panadol Extra Caplets - 1-2 tabs PRN',
    'Vitamin D3 5000 IU - 1 softgel daily after lunch',
  ]);
  const pdf2 = buildMinimalValidPdfBuffer([
    'Mohamed Abd Raboo Pharmacy - Lab & Insurance Attachment',
    'Patient: Nourhan Mahmoud | Reference: RX-2026-4102',
    'Insurance Card: CareMed Gold #CM-884120',
    'Allergies: None reported. Prefer original brand where available.',
    'Follow-up Notes: Please include digital blood pressure cuff check.',
  ]);
  fs.writeFileSync(path.join(rx1Dir, `${file1Id}.svg`), svg1);
  fs.writeFileSync(path.join(rx1Dir, `${file2Id}.pdf`), pdf2);

  const rx2Id = 'RX-2026-3985';
  const rx2Dir = path.join(UPLOADS_DIR, rx2Id);
  fs.mkdirSync(rx2Dir, { recursive: true });
  const file3Id = 'file-rx-3985-1';
  const svg2 = buildSampleRxSvgBuffer('Ahmed Hassan', [
    'Concor 5mg Tablet - 1 tablet once daily morning',
    'Lipitor 20mg Tablet - 1 tablet nightly',
  ]);
  fs.writeFileSync(path.join(rx2Dir, `${file3Id}.svg`), svg2);

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

  const seeded: StoredPrescriptionRecord[] = [
    {
      id: rx1Id,
      patientName: 'Nourhan Mahmoud',
      phone: '01014829304',
      address: '14 El-Gomhouria St, Mansoura',
      notes: 'Insurance card attached as PDF. Please confirm Augmentin stock.',
      files: [
        {
          id: file1Id,
          name: 'prescription-page-1.svg',
          mimeType: 'image/svg+xml',
          size: svg1.byteLength,
          fileType: 'image',
          url: `/api/prescriptions/${rx1Id}/files/${file1Id}`,
          uploadedAt: oneHourAgo,
          verificationStatus: 'pending',
        },
        {
          id: file2Id,
          name: 'insurance-and-lab-report.pdf',
          mimeType: 'application/pdf',
          size: pdf2.byteLength,
          fileType: 'pdf',
          url: `/api/prescriptions/${rx1Id}/files/${file2Id}`,
          uploadedAt: oneHourAgo,
          verificationStatus: 'pending',
        },
      ],
      fileStorageNames: {
        [file1Id]: `${file1Id}.svg`,
        [file2Id]: `${file2Id}.pdf`,
      },
      status: 'pending_review',
      submittedAt: oneHourAgo,
      updatedAt: oneHourAgo,
      statusHistory: [
        {
          status: 'pending_review',
          timestamp: oneHourAgo,
          actor: 'Patient Upload',
          note: '2 files uploaded (1 image, 1 PDF)',
        },
      ],
    },
    {
      id: rx2Id,
      linkedOrderNumber: 'MAR-88412',
      patientName: 'Ahmed Hassan',
      phone: '01129401182',
      address: '22 El-Mashaya El-Soflya, Mansoura',
      notes: 'Monthly chronic refill',
      files: [
        {
          id: file3Id,
          name: 'chronic-refill-rx.svg',
          mimeType: 'image/svg+xml',
          size: svg2.byteLength,
          fileType: 'image',
          url: `/api/prescriptions/${rx2Id}/files/${file3Id}`,
          uploadedAt: threeHoursAgo,
          verificationStatus: 'verified',
        },
      ],
      fileStorageNames: {
        [file3Id]: `${file3Id}.svg`,
      },
      status: 'approved',
      reviewedBy: 'Dr. Mohamed Abd Raboo',
      reviewNotes: 'All medications verified and available in refrigerated stock. Ready for dispatch.',
      estimatedTotal: 345,
      submittedAt: threeHoursAgo,
      updatedAt: twoHoursAgo,
      statusHistory: [
        {
          status: 'pending_review',
          timestamp: threeHoursAgo,
          actor: 'Patient Upload',
          note: '1 file uploaded',
        },
        {
          status: 'under_review',
          timestamp: twoHoursAgo,
          actor: 'Dr. Mohamed Abd Raboo',
          note: 'Pharmacist started review',
        },
        {
          status: 'approved',
          timestamp: twoHoursAgo,
          actor: 'Dr. Mohamed Abd Raboo',
          note: 'All medications verified and available in refrigerated stock. Ready for dispatch.',
        },
      ],
    },
  ];

  fs.writeFileSync(DB_FILE, JSON.stringify(seeded, null, 2), 'utf8');
  return seeded;
}

function readDb(): StoredPrescriptionRecord[] {
  return seedInitialDataIfNeeded();
}

function writeDb(records: StoredPrescriptionRecord[]) {
  ensureStorageDirs();
  fs.writeFileSync(DB_FILE, JSON.stringify(records, null, 2), 'utf8');
}

function seedLoyaltyIfNeeded(): UserLoyaltyProfile {
  ensureStorageDirs();
  if (fs.existsSync(LOYALTY_FILE)) {
    try {
      const raw = fs.readFileSync(LOYALTY_FILE, 'utf8');
      const parsed = JSON.parse(raw) as UserLoyaltyProfile;
      if (parsed && typeof parsed.pointsBalance === 'number') {
        return parsed;
      }
    } catch {
      // fall through to re-seed if corrupted
    }
  }

  const now = Date.now();
  const seeded: UserLoyaltyProfile = {
    memberId: 'MAR-CLUB-1042',
    fullName: 'محمود عادل',
    phone: '01024891120',
    address: 'شارع الجمهورية الرئيسي، المنصورة',
    pointsBalance: 136,
    lifetimeEarned: 236,
    lifetimeRedeemed: 100,
    ordersCount: 3,
    updatedAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
    transactions: [
      {
        id: 'loy-seed-3',
        type: 'earned',
        points: 11,
        egpValue: 1150,
        orderNumber: 'MAR-88412',
        descriptionAr: 'نقاط مكتسبة من الطلب #MAR-88412',
        descriptionEn: 'Points earned from order #MAR-88412',
        createdAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'loy-seed-2',
        type: 'redeemed',
        points: 100,
        egpValue: 50,
        orderNumber: 'MAR-86109',
        descriptionAr: 'استبدال نقاط بخصم 50 ج.م على الطلب #MAR-86109',
        descriptionEn: 'Redeemed 100 pts for 50 EGP discount on #MAR-86109',
        createdAt: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'loy-seed-1',
        type: 'bonus',
        points: 225,
        egpValue: 112,
        descriptionAr: 'نقاط ترحيبية ومشتريات سابقة في نادي الولاء',
        descriptionEn: 'Welcome club bonus & prior purchase points',
        createdAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  };

  fs.writeFileSync(LOYALTY_FILE, JSON.stringify(seeded, null, 2), 'utf8');
  return seeded;
}

function writeLoyaltyDb(profile: UserLoyaltyProfile) {
  ensureStorageDirs();
  fs.writeFileSync(LOYALTY_FILE, JSON.stringify(profile, null, 2), 'utf8');
}

function readCustomProducts(): Product[] {
  ensureStorageDirs();
  if (!fs.existsSync(CUSTOM_PRODUCTS_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(CUSTOM_PRODUCTS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Product[]) : [];
  } catch {
    return [];
  }
}

function writeCustomProducts(products: Product[]) {
  ensureStorageDirs();
  fs.writeFileSync(CUSTOM_PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');
}

function saveCustomProductImage(base64Input: string): string | null {
  const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i.exec(base64Input.trim());
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const payload = match[2];
  const buffer = Buffer.from(payload, 'base64');
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
    throw new Error('Image exceeds 5MB limit or is invalid');
  }
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const fileName = `prod-${crypto.randomUUID()}.${ext}`;
  ensureStorageDirs();
  fs.writeFileSync(path.join(UPLOADS_DIR, fileName), buffer);
  return `/api/products/images/${fileName}`;
}

function toPublicRecord(record: StoredPrescriptionRecord): PrescriptionSubmission {
  const { fileStorageNames: _ignored, ...publicRecord } = record;
  return publicRecord;
}

function extensionFromMime(mime: string, originalName: string): string {
  switch (mime) {
    case 'application/pdf':
      return 'pdf';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/svg+xml':
      return 'svg';
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    default: {
      const ext = path.extname(originalName).replace('.', '').toLowerCase();
      return ext && /^[a-z0-9]+$/.test(ext) ? ext : 'bin';
    }
  }
}

function decodeBase64Payload(base64Data: string): Buffer {
  const commaIdx = base64Data.indexOf(',');
  const rawBase64 = commaIdx !== -1 ? base64Data.slice(commaIdx + 1) : base64Data;
  return Buffer.from(rawBase64, 'base64');
}

function saveFilesForOrder(
  rxId: string,
  incomingFiles: IncomingUploadFile[],
  nowIso: string
): { files: PrescriptionFile[]; storageNames: Record<string, string> } {
  const orderDir = path.join(UPLOADS_DIR, rxId);
  fs.mkdirSync(orderDir, { recursive: true });

  const files: PrescriptionFile[] = [];
  const storageNames: Record<string, string> = {};

  for (const item of incomingFiles) {
    const mimeType = String(item.mimeType || '').toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
    const buffer = decodeBase64Payload(String(item.base64Data || ''));
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_FILE_BYTES) {
      throw new Error(`Invalid file size for ${item.name}`);
    }

    const fileId = `f-${crypto.randomUUID().slice(0, 8)}`;
    const ext = extensionFromMime(mimeType, String(item.name || 'file'));
    const diskName = `${fileId}.${ext}`;
    fs.writeFileSync(path.join(orderDir, diskName), buffer);

    storageNames[fileId] = diskName;
    files.push({
      id: fileId,
      name: String(item.name || `prescription.${ext}`).slice(0, 140),
      mimeType,
      size: buffer.byteLength,
      fileType: mimeType === 'application/pdf' ? 'pdf' : 'image',
      url: `/api/prescriptions/${rxId}/files/${fileId}`,
      uploadedAt: nowIso,
      verificationStatus: 'pending',
    });
  }

  return { files, storageNames };
}

async function startServer() {
  ensureStorageDirs();
  seedInitialDataIfNeeded();

  const app = express();
  app.use(express.json({ limit: '60mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Pharmacist Staff Portal Authentication
  app.post('/api/staff/login', (req, res) => {
    const body = req.body as { pharmacistName?: string; passcode?: string };
    const submittedName = String(body.pharmacistName || '').trim().toLowerCase();
    const submittedCode = String(body.passcode || '').trim();

    if (
      !submittedName ||
      !submittedCode ||
      !timingSafeTextEqual(submittedName, STAFF_ALLOWED_NAME) ||
      !timingSafeTextEqual(submittedCode, STAFF_ALLOWED_CODE)
    ) {
      res.status(401).json({ error: 'Invalid pharmacist name or passcode' });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const session: StaffSession = {
      pharmacistName: 'mohamed',
      createdAt: Date.now(),
    };
    staffSessions.set(token, session);

    res.json({
      token,
      pharmacistName: session.pharmacistName,
    });
  });

  app.get('/api/staff/session', (req, res) => {
    const session = getActiveStaffSession(req);
    if (!session) {
      res.status(401).json({ authenticated: false });
      return;
    }
    res.json({
      authenticated: true,
      pharmacistName: session.pharmacistName,
    });
  });

  app.post('/api/staff/logout', (req, res) => {
    const token = getBearerToken(req);
    if (token) {
      staffSessions.delete(token);
    }
    res.json({ ok: true });
  });

  // Server-Sent Events stream for real-time prescription status alerts
  app.get('/api/prescriptions/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);
    sseClients.add(res);

    const heartbeat = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // List prescription orders
  app.get('/api/prescriptions', (req, res) => {
    const statusFilter = typeof req.query.status === 'string' ? req.query.status : 'all';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

    let records = readDb();
    if (statusFilter !== 'all' && VALID_STATUSES.has(statusFilter as PrescriptionStatus)) {
      records = records.filter((r) => r.status === statusFilter);
    }
    if (q) {
      records = records.filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          r.patientName.toLowerCase().includes(q) ||
          r.phone.toLowerCase().includes(q) ||
          (r.linkedOrderNumber && r.linkedOrderNumber.toLowerCase().includes(q))
      );
    }

    records.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    res.json(records.map(toPublicRecord));
  });

  // Get single prescription order
  app.get('/api/prescriptions/:id', (req, res) => {
    const { id } = req.params;
    if (!VALID_ID_RE.test(id)) {
      res.status(400).json({ error: 'Invalid prescription ID' });
      return;
    }
    const record = readDb().find((r) => r.id === id);
    if (!record) {
      res.status(404).json({ error: 'Prescription order not found' });
      return;
    }
    res.json(toPublicRecord(record));
  });

  // Create a prescription order with multiple files
  app.post('/api/prescriptions', (req, res) => {
    try {
      const body = req.body as {
        patientName?: string;
        phone?: string;
        address?: string;
        notes?: string;
        linkedOrderNumber?: string;
        linkedItems?: LinkedOrderItem[];
        files?: IncomingUploadFile[];
      };

      const patientName = String(body.patientName || '').trim();
      const phone = String(body.phone || '').trim();
      const address = String(body.address || '').trim();
      const notes = String(body.notes || '').trim();
      const linkedOrderNumber = body.linkedOrderNumber
        ? String(body.linkedOrderNumber).trim()
        : undefined;
      const incomingFiles = Array.isArray(body.files) ? body.files : [];

      if (!patientName || !phone || !address) {
        res.status(400).json({ error: 'Patient name, phone, and delivery address are required.' });
        return;
      }

      if (incomingFiles.length === 0 || incomingFiles.length > MAX_FILES_PER_ORDER) {
        res
          .status(400)
          .json({ error: `Please upload between 1 and ${MAX_FILES_PER_ORDER} files per order.` });
        return;
      }

      const records = readDb();
      let rxId = `RX-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      while (records.some((r) => r.id === rxId)) {
        rxId = `RX-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      }

      const nowIso = new Date().toISOString();
      const { files, storageNames } = saveFilesForOrder(rxId, incomingFiles, nowIso);

      const newRecord: StoredPrescriptionRecord = {
        id: rxId,
        linkedOrderNumber,
        linkedItems: Array.isArray(body.linkedItems) ? body.linkedItems : undefined,
        patientName,
        phone,
        address,
        notes,
        files,
        fileStorageNames: storageNames,
        status: 'pending_review',
        submittedAt: nowIso,
        updatedAt: nowIso,
        statusHistory: [
          {
            status: 'pending_review',
            timestamp: nowIso,
            actor: patientName,
            note: `${files.length} file(s) uploaded for review`,
          },
        ],
      };

      records.unshift(newRecord);
      writeDb(records);

      const createdPublic = toPublicRecord(newRecord);
      broadcastPrescriptionEvent('prescription_updated', createdPublic);
      res.status(201).json(createdPublic);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save prescription order';
      res.status(400).json({ error: message });
    }
  });

  // Append additional files to an existing order
  app.post('/api/prescriptions/:id/files', (req, res) => {
    try {
      const { id } = req.params;
      if (!VALID_ID_RE.test(id)) {
        res.status(400).json({ error: 'Invalid prescription ID' });
        return;
      }

      const body = req.body as { files?: IncomingUploadFile[] };
      const incomingFiles = Array.isArray(body.files) ? body.files : [];
      if (incomingFiles.length === 0) {
        res.status(400).json({ error: 'No files provided.' });
        return;
      }

      const records = readDb();
      const idx = records.findIndex((r) => r.id === id);
      if (idx === -1) {
        res.status(404).json({ error: 'Prescription order not found' });
        return;
      }

      const current = records[idx];
      if (current.files.length + incomingFiles.length > MAX_FILES_PER_ORDER) {
        res
          .status(400)
          .json({ error: `Maximum ${MAX_FILES_PER_ORDER} files allowed per order.` });
        return;
      }

      const nowIso = new Date().toISOString();
      const { files, storageNames } = saveFilesForOrder(id, incomingFiles, nowIso);

      const nextStatus: PrescriptionStatus =
        current.status === 'needs_clarification' ? 'pending_review' : current.status;

      const updated: StoredPrescriptionRecord = {
        ...current,
        files: [...current.files, ...files],
        fileStorageNames: { ...current.fileStorageNames, ...storageNames },
        status: nextStatus,
        updatedAt: nowIso,
        statusHistory: [
          ...current.statusHistory,
          {
            status: nextStatus,
            timestamp: nowIso,
            actor: current.patientName,
            note: `Added ${files.length} additional file(s)`,
          },
        ],
      };

      records[idx] = updated;
      writeDb(records);
      res.json(toPublicRecord(updated));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to append files';
      res.status(400).json({ error: message });
    }
  });

  // Remove a file from an order while in reviewable state
  app.delete('/api/prescriptions/:id/files/:fileId', (req, res) => {
    const { id, fileId } = req.params;
    if (!VALID_ID_RE.test(id) || !VALID_ID_RE.test(fileId)) {
      res.status(400).json({ error: 'Invalid identifier' });
      return;
    }

    const records = readDb();
    const idx = records.findIndex((r) => r.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Prescription order not found' });
      return;
    }

    const current = records[idx];
    if (current.files.length <= 1) {
      res.status(400).json({ error: 'An order must retain at least one prescription file.' });
      return;
    }

    const diskName = current.fileStorageNames[fileId];
    if (diskName) {
      const targetPath = path.join(UPLOADS_DIR, id, diskName);
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
      delete current.fileStorageNames[fileId];
    }

    const nowIso = new Date().toISOString();
    current.files = current.files.filter((f) => f.id !== fileId);
    current.updatedAt = nowIso;
    records[idx] = current;
    writeDb(records);

    res.json(toPublicRecord(current));
  });

  // Serve an uploaded image or PDF file inline
  app.get('/api/prescriptions/:id/files/:fileId', (req, res) => {
    const { id, fileId } = req.params;
    if (!VALID_ID_RE.test(id) || !VALID_ID_RE.test(fileId)) {
      res.status(400).json({ error: 'Invalid identifier' });
      return;
    }

    const record = readDb().find((r) => r.id === id);
    if (!record) {
      res.status(404).json({ error: 'Prescription order not found' });
      return;
    }

    const fileMeta = record.files.find((f) => f.id === fileId);
    const diskName = record.fileStorageNames[fileId];
    if (!fileMeta || !diskName) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const filePath = path.join(UPLOADS_DIR, id, diskName);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File missing on disk' });
      return;
    }

    res.setHeader('Content-Type', fileMeta.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(fileMeta.name)}"`
    );
    res.sendFile(filePath);
  });

  // Staff review & status update endpoint (protected by pharmacist session)
  app.patch('/api/prescriptions/:id/review', (req, res) => {
    const session = getActiveStaffSession(req);
    if (!session) {
      res.status(401).json({ error: 'Pharmacist authentication required' });
      return;
    }

    const { id } = req.params;
    if (!VALID_ID_RE.test(id)) {
      res.status(400).json({ error: 'Invalid prescription ID' });
      return;
    }

    const body = req.body as {
      status?: PrescriptionStatus;
      reviewedBy?: string;
      reviewNotes?: string;
      estimatedTotal?: number | null;
      fileUpdates?: Array<{
        fileId: string;
        verificationStatus: PrescriptionFileStatus;
        staffNote?: string;
      }>;
    };

    const records = readDb();
    const idx = records.findIndex((r) => r.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Prescription order not found' });
      return;
    }

    const current = records[idx];
    const nowIso = new Date().toISOString();
    const reviewer = String(body.reviewedBy || current.reviewedBy || 'Pharmacy Staff').trim();

    let updatedFiles = [...current.files];
    if (Array.isArray(body.fileUpdates) && body.fileUpdates.length > 0) {
      const updateMap = new Map(body.fileUpdates.map((u) => [u.fileId, u]));
      updatedFiles = updatedFiles.map((f) => {
        const upd = updateMap.get(f.id);
        if (!upd) return f;
        return {
          ...f,
          verificationStatus: upd.verificationStatus,
          staffNote: upd.staffNote !== undefined ? upd.staffNote : f.staffNote,
        };
      });
    }

    const nextStatus =
      body.status && VALID_STATUSES.has(body.status) ? body.status : current.status;
    const nextNotes =
      body.reviewNotes !== undefined ? String(body.reviewNotes).trim() : current.reviewNotes;
    const nextTotal =
      body.estimatedTotal === null
        ? undefined
        : typeof body.estimatedTotal === 'number' && Number.isFinite(body.estimatedTotal)
          ? Math.max(0, body.estimatedTotal)
          : current.estimatedTotal;

    const statusChanged = nextStatus !== current.status || Boolean(body.status);
    const nextHistory = [...current.statusHistory];
    if (statusChanged) {
      nextHistory.push({
        status: nextStatus,
        timestamp: nowIso,
        actor: reviewer,
        note: nextNotes || undefined,
      });
    }

    const updated: StoredPrescriptionRecord = {
      ...current,
      files: updatedFiles,
      status: nextStatus,
      reviewedBy: reviewer,
      reviewNotes: nextNotes,
      estimatedTotal: nextTotal,
      updatedAt: nowIso,
      statusHistory: nextHistory,
    };

    records[idx] = updated;
    writeDb(records);
    const updatedPublic = toPublicRecord(updated);
    broadcastPrescriptionEvent('prescription_updated', updatedPublic);
    res.json(updatedPublic);
  });

  // Loyalty Profile & Points Endpoints
  app.get('/api/loyalty', (_req, res) => {
    res.json(seedLoyaltyIfNeeded());
  });

  app.patch('/api/loyalty/profile', (req, res) => {
    const body = req.body as {
      fullName?: string;
      phone?: string;
      address?: string;
    };
    const current = seedLoyaltyIfNeeded();
    const next: UserLoyaltyProfile = {
      ...current,
      fullName: body.fullName !== undefined ? String(body.fullName).trim() : current.fullName,
      phone: body.phone !== undefined ? String(body.phone).trim() : current.phone,
      address: body.address !== undefined ? String(body.address).trim() : current.address,
      updatedAt: new Date().toISOString(),
    };
    writeLoyaltyDb(next);
    res.json(next);
  });

  app.post('/api/loyalty/orders', (req, res) => {
    const body = req.body as {
      orderNumber?: string;
      customerName?: string;
      phone?: string;
      address?: string;
      subtotalPaidAfterDiscounts?: number;
      redeemPoints?: number;
    };

    const current = seedLoyaltyIfNeeded();
    const orderNumber = String(body.orderNumber || `MAR-${Math.floor(10000 + Math.random() * 90000)}`).trim();
    const rawSubtotal = Number(body.subtotalPaidAfterDiscounts ?? 0);
    const paidBase = Number.isFinite(rawSubtotal) ? Math.max(0, rawSubtotal) : 0;

    // Validate requested points redemption safely
    const requestedRedeem = Math.max(0, Math.floor(Number(body.redeemPoints || 0)));
    const maxAllowedBySubtotal = Math.floor(paidBase / 0.5);
    const validRedeem =
      requestedRedeem >= 20
        ? Math.floor(
            Math.min(requestedRedeem, current.pointsBalance, maxAllowedBySubtotal) / 10
          ) * 10
        : 0;
    const pointsDiscount = Math.floor(validRedeem * 0.5);
    const finalPaidAfterPoints = Math.max(0, paidBase - pointsDiscount);

    // Tier multiplier: Silver 1x, Gold (500+) 1.25x, Platinum (1500+) 1.5x
    const multiplier =
      current.lifetimeEarned >= 1500 ? 1.5 : current.lifetimeEarned >= 500 ? 1.25 : 1;
    // Earn rate: 1 point per 100 EGP spent (multiplied by tier)
    const pointsEarned =
      finalPaidAfterPoints >= 100
        ? Math.max(1, Math.floor((finalPaidAfterPoints / 100) * multiplier))
        : 0;

    const nowIso = new Date().toISOString();
    const nextTransactions: LoyaltyTransaction[] = [...current.transactions];

    if (validRedeem > 0) {
      nextTransactions.unshift({
        id: `loy-${crypto.randomUUID().slice(0, 8)}`,
        type: 'redeemed',
        points: validRedeem,
        egpValue: pointsDiscount,
        orderNumber,
        descriptionAr: `استبدال ${validRedeem} نقطة بخصم ${pointsDiscount} ج.م على الطلب #${orderNumber}`,
        descriptionEn: `Redeemed ${validRedeem} pts for ${pointsDiscount} EGP off order #${orderNumber}`,
        createdAt: nowIso,
      });
    }

    if (pointsEarned > 0) {
      nextTransactions.unshift({
        id: `loy-${crypto.randomUUID().slice(0, 8)}`,
        type: 'earned',
        points: pointsEarned,
        egpValue: finalPaidAfterPoints,
        orderNumber,
        descriptionAr: `نقاط مكتسبة من الطلب #${orderNumber}`,
        descriptionEn: `Points earned from purchase #${orderNumber}`,
        createdAt: nowIso,
      });
    }

    const updated: UserLoyaltyProfile = {
      ...current,
      fullName: body.customerName ? String(body.customerName).trim() : current.fullName,
      phone: body.phone ? String(body.phone).trim() : current.phone,
      address: body.address ? String(body.address).trim() : current.address,
      pointsBalance: Math.max(0, current.pointsBalance - validRedeem + pointsEarned),
      lifetimeEarned: current.lifetimeEarned + pointsEarned,
      lifetimeRedeemed: current.lifetimeRedeemed + validRedeem,
      ordersCount: current.ordersCount + 1,
      transactions: nextTransactions.slice(0, 50),
      updatedAt: nowIso,
    };

    writeLoyaltyDb(updated);
    res.json({
      profile: updated,
      pointsRedeemed: validRedeem,
      pointsDiscount,
      pointsEarned,
    });
  });

  // Custom Pharmacist-Managed Products Endpoints
  app.get('/api/products/custom', (_req, res) => {
    res.json(readCustomProducts());
  });

  app.get('/api/products/images/:fileName', (req, res) => {
    const { fileName } = req.params;
    if (!/^prod-[a-zA-Z0-9-]+\.(jpg|png|webp)$/.test(fileName)) {
      res.status(400).json({ error: 'Invalid image file name' });
      return;
    }
    const target = path.resolve(UPLOADS_DIR, fileName);
    if (!target.startsWith(UPLOADS_DIR) || !fs.existsSync(target)) {
      res.status(404).json({ error: 'Product image not found' });
      return;
    }
    res.sendFile(target);
  });

  app.post('/api/products/custom', (req, res) => {
    const staffSession = getActiveStaffSession(req);
    if (!staffSession) {
      res.status(401).json({ error: 'Pharmacist authentication required' });
      return;
    }

    try {
      const body = req.body as {
        nameAr?: string;
        nameEn?: string;
        brandAr?: string;
        brandEn?: string;
        categoryId?: CategoryId;
        price?: number;
        originalPrice?: number;
        stockCount?: number;
        sku?: string;
        shortDescAr?: string;
        shortDescEn?: string;
        descriptionAr?: string;
        descriptionEn?: string;
        requiresPrescription?: boolean;
        isOffer?: boolean;
        isFeatured?: boolean;
        imageBase64?: string;
      };

      const nameAr = String(body.nameAr || '').trim();
      const nameEn = String(body.nameEn || '').trim() || nameAr;
      const categoryId = body.categoryId && VALID_CATEGORY_IDS.has(body.categoryId)
        ? body.categoryId
        : 'medicines';
      const price = Number(body.price);
      const originalPriceRaw = body.originalPrice !== undefined ? Number(body.originalPrice) : undefined;
      const stockCount = Math.max(0, Math.floor(Number(body.stockCount ?? 20)));

      if (!nameAr || !Number.isFinite(price) || price <= 0) {
        res.status(400).json({ error: 'Product name and valid price are required' });
        return;
      }

      const brandAr = String(body.brandAr || '').trim() || 'صيدلية محمد عبد ربه';
      const brandEn = String(body.brandEn || '').trim() || brandAr;
      const shortDescAr =
        String(body.shortDescAr || '').trim() ||
        'منتج صيدلاني معتمد مضاف عبر الصيدلية وجاهز للطلب والتوصيل.';
      const shortDescEn =
        String(body.shortDescEn || '').trim() ||
        'Verified pharmacy product added by staff and available for immediate order.';
      const descriptionAr = String(body.descriptionAr || '').trim() || shortDescAr;
      const descriptionEn = String(body.descriptionEn || '').trim() || shortDescEn;

      const originalPrice =
        originalPriceRaw !== undefined && Number.isFinite(originalPriceRaw) && originalPriceRaw > price
          ? Math.round(originalPriceRaw * 100) / 100
          : undefined;

      const customProducts = readCustomProducts();
      const rawSku = String(body.sku || '').trim();
      const sku =
        rawSku ||
        `MAR-ADD-${String(101 + customProducts.length).padStart(3, '0')}`;

      let imageUrl = CATEGORY_DEFAULT_IMAGES[categoryId];
      if (typeof body.imageBase64 === 'string' && body.imageBase64.trim()) {
        const savedUrl = saveCustomProductImage(body.imageBase64);
        if (savedUrl) {
          imageUrl = savedUrl;
        }
      }

      const product: Product = {
        id: `custom-${crypto.randomUUID().slice(0, 8)}`,
        sku,
        categoryId,
        nameAr,
        nameEn,
        shortDescAr,
        shortDescEn,
        descriptionAr,
        descriptionEn,
        brandAr,
        brandEn,
        price: Math.round(price * 100) / 100,
        originalPrice,
        stockCount: Number.isFinite(stockCount) ? stockCount : 20,
        image: imageUrl,
        isFeatured: body.isFeatured !== false,
        isNewArrival: true,
        isOffer: Boolean(body.isOffer || originalPrice),
        requiresPrescription: Boolean(body.requiresPrescription),
        specs: [
          {
            labelAr: 'كود الصنف',
            labelEn: 'Product SKU',
            valueAr: sku,
            valueEn: sku,
          },
          {
            labelAr: 'أضيف بواسطة',
            labelEn: 'Added By',
            valueAr: `الصيدلي (${staffSession.pharmacistName})`,
            valueEn: `Pharmacist (${staffSession.pharmacistName})`,
          },
        ],
        rating: 5.0,
        reviewCount: 1,
      };

      const nextList = [product, ...customProducts];
      writeCustomProducts(nextList);
      res.status(201).json(product);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create product';
      res.status(400).json({ error: msg });
    }
  });

  app.delete('/api/products/custom/:id', (req, res) => {
    const staffSession = getActiveStaffSession(req);
    if (!staffSession) {
      res.status(401).json({ error: 'Pharmacist authentication required' });
      return;
    }

    const { id } = req.params;
    const current = readCustomProducts();
    const target = current.find((p) => p.id === id);
    if (!target) {
      res.status(404).json({ error: 'Custom product not found' });
      return;
    }

    const updated = current.filter((p) => p.id !== id);
    writeCustomProducts(updated);

    if (target.image.startsWith('/api/products/images/')) {
      const fileName = target.image.replace('/api/products/images/', '');
      const filePath = path.resolve(UPLOADS_DIR, fileName);
      if (filePath.startsWith(UPLOADS_DIR) && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          // ignore cleanup failure
        }
      }
    }

    res.json({ ok: true });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Mohamed Abd Raboo Pharmacy server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
