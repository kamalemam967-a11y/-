import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock,
  Eye,
  FilePlus2,
  FileText,
  FileUp,
  RefreshCw,
  Search,
  ShieldCheck,
  Stethoscope,
  Trash2,
} from 'lucide-react';
import { t } from '../data/translations';
import {
  addFilesToPrescription,
  createPrescriptionOrder,
  fileToStagedUpload,
  formatFileSize,
  MAX_FILES_PER_ORDER,
  removePrescriptionFile,
  StagedUploadFile,
} from '../services/prescriptionApi';
import { BrowserNotificationPermission } from '../services/prescriptionNotifications';
import { Language, PrescriptionSubmission, Product } from '../types/pharmacy';
import { BrowserNotificationPromptBar } from './NotificationCenter';
import { PrescriptionCameraModal } from './PrescriptionCameraModal';
import { PreviewableFile, PrescriptionFileViewer } from './PrescriptionFileViewer';
import {
  FileVerificationLabel,
  PrescriptionProgressSteps,
  PrescriptionStatusIndicator,
} from './PrescriptionStatusBadge';
import { StaffPrescriptionPortal } from './StaffPrescriptionPortal';

interface PrescriptionViewProps {
  lang: Language;
  initialMode?: 'patient' | 'staff';
  submissions: PrescriptionSubmission[];
  isLoading: boolean;
  onRefresh: () => void;
  onOrderCreated: (submission: PrescriptionSubmission) => void;
  onOrderUpdated: (updated: PrescriptionSubmission) => void;
  onBackHome: () => void;
  notificationPermission?: BrowserNotificationPermission;
  onRequestNotificationPermission?: () => Promise<void> | void;
  onSendTestNotification?: () => void;
  defaultCustomerName?: string;
  defaultCustomerPhone?: string;
  defaultCustomerAddress?: string;
  customProducts?: Product[];
  onProductAdded?: (product: Product) => void;
  onProductDeleted?: (productId: string) => void;
}

export const PrescriptionView: React.FC<PrescriptionViewProps> = ({
  lang,
  initialMode = 'patient',
  submissions,
  isLoading,
  onRefresh,
  onOrderCreated,
  onOrderUpdated,
  onBackHome,
  notificationPermission = 'unsupported',
  onRequestNotificationPermission,
  onSendTestNotification,
  defaultCustomerName = '',
  defaultCustomerPhone = '',
  defaultCustomerAddress = '',
  customProducts = [],
  onProductAdded,
  onProductDeleted,
}) => {
  const [workspaceMode, setWorkspaceMode] = useState<'patient' | 'staff'>(initialMode);
  const [patientName, setPatientName] = useState(defaultCustomerName);
  const [phone, setPhone] = useState(defaultCustomerPhone);
  const [address, setAddress] = useState(defaultCustomerAddress);
  const [linkedOrderNumber, setLinkedOrderNumber] = useState('');
  const [notes, setNotes] = useState('');

  const [stagedFiles, setStagedFiles] = useState<StagedUploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [latestReceiptId, setLatestReceiptId] = useState<string | null>(null);

  const [orderSearch, setOrderSearch] = useState('');
  const [appendingOrderId, setAppendingOrderId] = useState<string | null>(null);
  const [appendError, setAppendError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<PreviewableFile | null>(null);
  const [cameraTarget, setCameraTarget] = useState<'new' | string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const appendFileInputRef = useRef<HTMLInputElement>(null);
  const appendTargetOrderRef = useRef<string | null>(null);

  const copy = t(lang);
  const BackArrow = lang === 'ar' ? ArrowRight : ArrowLeft;

  const pendingCount = useMemo(
    () =>
      submissions.filter(
        (s) => s.status === 'pending_review' || s.status === 'under_review'
      ).length,
    [submissions]
  );

  const latestReceipt = useMemo(
    () => submissions.find((s) => s.id === latestReceiptId) || null,
    [submissions, latestReceiptId]
  );

  const filteredSubmissions = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    if (!q) return submissions;
    return submissions.filter(
      (sub) =>
        sub.id.toLowerCase().includes(q) ||
        sub.patientName.toLowerCase().includes(q) ||
        sub.phone.toLowerCase().includes(q) ||
        (sub.linkedOrderNumber && sub.linkedOrderNumber.toLowerCase().includes(q))
    );
  }, [submissions, orderSearch]);

  const stageSelectedFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploadError(null);

    const incoming = Array.from(fileList);
    if (stagedFiles.length + incoming.length > MAX_FILES_PER_ORDER) {
      setUploadError(copy.prescription.fileLimitError);
      return;
    }

    const nextStaged: StagedUploadFile[] = [];
    for (const file of incoming) {
      try {
        const staged = await fileToStagedUpload(file);
        nextStaged.push(staged);
      } catch (err) {
        const code = err instanceof Error ? err.message : '';
        setUploadError(
          code === 'FILE_TOO_LARGE'
            ? copy.prescription.fileLimitError
            : copy.prescription.fileTypeError
        );
      }
    }

    if (nextStaged.length > 0) {
      setStagedFiles((prev) => [...prev, ...nextStaged].slice(0, MAX_FILES_PER_ORDER));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await stageSelectedFiles(e.target.files);
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    await stageSelectedFiles(e.dataTransfer.files);
  };

  const handleRemoveStaged = (localId: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.localId !== localId));
  };

  const handlePreviewStaged = (file: StagedUploadFile) => {
    const url = file.previewUrl || file.base64Data;
    setPreviewFile({
      name: file.name,
      url,
      fileType: file.fileType,
      size: file.size,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim() || !phone.trim() || !address.trim() || stagedFiles.length === 0) {
      return;
    }

    setIsSubmitting(true);
    setUploadError(null);
    try {
      const created = await createPrescriptionOrder({
        patientName: patientName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        notes: notes.trim(),
        linkedOrderNumber: linkedOrderNumber.trim() || undefined,
        files: stagedFiles.map(({ name, mimeType, size, base64Data }) => ({
          name,
          mimeType,
          size,
          base64Data,
        })),
      });

      onOrderCreated(created);
      setLatestReceiptId(created.id);
      setPatientName('');
      setPhone('');
      setAddress('');
      setLinkedOrderNumber('');
      setNotes('');
      setStagedFiles([]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : copy.prescription.submitError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerAppendFiles = (rxId: string) => {
    appendTargetOrderRef.current = rxId;
    setAppendError(null);
    appendFileInputRef.current?.click();
  };

  const handleAppendFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetId = appendTargetOrderRef.current;
    const files = e.target.files;
    if (!targetId || !files || files.length === 0) return;

    setAppendingOrderId(targetId);
    setAppendError(null);
    try {
      const payloads = [];
      for (const file of Array.from(files)) {
        const staged = await fileToStagedUpload(file);
        payloads.push({
          name: staged.name,
          mimeType: staged.mimeType,
          size: staged.size,
          base64Data: staged.base64Data,
        });
      }
      const updated = await addFilesToPrescription(targetId, payloads);
      onOrderUpdated(updated);
    } catch (err) {
      setAppendError(err instanceof Error ? err.message : copy.prescription.submitError);
    } finally {
      setAppendingOrderId(null);
      e.target.value = '';
    }
  };

  const handleDeleteExistingFile = async (rxId: string, fileId: string) => {
    try {
      const updated = await removePrescriptionFile(rxId, fileId);
      onOrderUpdated(updated);
    } catch (err) {
      setAppendError(err instanceof Error ? err.message : copy.prescription.submitError);
    }
  };

  const handleCameraCapturedFile = async (file: File) => {
    if (!cameraTarget) return;
    if (cameraTarget === 'new') {
      setUploadError(null);
      if (stagedFiles.length >= MAX_FILES_PER_ORDER) {
        setUploadError(copy.prescription.fileLimitError);
        return;
      }
      try {
        const staged = await fileToStagedUpload(file);
        setStagedFiles((prev) => [...prev, staged].slice(0, MAX_FILES_PER_ORDER));
      } catch (err) {
        const code = err instanceof Error ? err.message : '';
        setUploadError(
          code === 'FILE_TOO_LARGE'
            ? copy.prescription.fileLimitError
            : copy.prescription.fileTypeError
        );
      }
      return;
    }

    const targetOrderId = cameraTarget;
    setAppendingOrderId(targetOrderId);
    setAppendError(null);
    try {
      const staged = await fileToStagedUpload(file);
      const updated = await addFilesToPrescription(targetOrderId, [
        {
          name: staged.name,
          mimeType: staged.mimeType,
          size: staged.size,
          base64Data: staged.base64Data,
        },
      ]);
      onOrderUpdated(updated);
    } catch (err) {
      setAppendError(err instanceof Error ? err.message : copy.prescription.submitError);
    } finally {
      setAppendingOrderId(null);
    }
  };

  const formatTimestamp = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Top Breadcrumb + Workspace Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-700 transition-colors cursor-pointer self-start"
        >
          <BackArrow className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{copy.product.backToHome}</span>
        </button>

        {/* Segmented Workspace Control: Patient Portal vs Pharmacy Staff Review Desk */}
        <div
          className="inline-flex items-center gap-1 p-1 bg-slate-200/65 rounded-xl self-start sm:self-auto"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={workspaceMode === 'patient'}
            onClick={() => setWorkspaceMode('patient')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              workspaceMode === 'patient'
                ? 'bg-white text-blue-800 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <FileUp className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{copy.prescription.patientTab}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={workspaceMode === 'staff'}
            onClick={() => setWorkspaceMode('staff')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              workspaceMode === 'staff'
                ? 'bg-white text-blue-800 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{copy.prescription.staffTab}</span>
            <span className="font-mono-tabular text-[11px] bg-blue-100/80 text-blue-800 px-1.5 py-0.5 rounded-md">
              {pendingCount}
            </span>
          </button>
        </div>
      </div>

      {workspaceMode === 'staff' ? (
        <StaffPrescriptionPortal
          lang={lang}
          submissions={submissions}
          onOrderUpdated={onOrderUpdated}
          customProducts={customProducts}
          onProductAdded={onProductAdded}
          onProductDeleted={onProductDeleted}
        />
      ) : (
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Patient Multi-File Upload Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-7 space-y-5">
            <div className="space-y-1.5 border-b border-slate-100 pb-4">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                {copy.prescription.title}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
                {copy.prescription.subtitle}
              </p>
            </div>

            {latestReceipt ? (
              <div className="bg-blue-50/60 border border-blue-200/80 rounded-2xl p-5 sm:p-6 text-center space-y-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">
                  {copy.prescription.successTitle}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600">{copy.prescription.successDesc}</p>
                <div className="flex flex-col items-center gap-2">
                  <p className="font-mono-tabular text-base font-bold text-blue-800">
                    {latestReceipt.id}
                  </p>
                  <PrescriptionStatusIndicator status={latestReceipt.status} lang={lang} />
                </div>
                <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                  {copy.prescription.successFollowup}
                </p>
                <div className="pt-1 flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setLatestReceiptId(null)}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold cursor-pointer"
                  >
                    {copy.prescription.uploadAnother}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Multi-File Dropzone + Live Camera Capture */}
                <div className="space-y-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/gif,.pdf,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="rx-multi-file-input"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          fileInputRef.current?.click();
                        }
                      }}
                      className={`sm:col-span-8 border-2 border-dashed rounded-2xl p-5 sm:p-6 text-center transition-colors cursor-pointer flex items-center justify-center ${
                        isDragging
                          ? 'border-blue-500 bg-blue-50/70'
                          : 'border-slate-300/90 hover:border-blue-400 bg-slate-50/60 hover:bg-blue-50/40'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 border border-sky-100 flex items-center justify-center mx-auto">
                          <FileUp className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <p className="text-xs sm:text-sm font-semibold text-slate-800">
                          {copy.prescription.uploadLabel}
                        </p>
                        <p className="text-[11px] text-slate-500">{copy.prescription.uploadHint}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCameraTarget('new')}
                      className="sm:col-span-4 border border-blue-200/80 hover:border-blue-400 bg-blue-50/55 hover:bg-blue-50 rounded-2xl p-5 text-center transition-colors cursor-pointer flex flex-col items-center justify-center gap-2"
                    >
                      <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                        <Camera className="w-5 h-5" aria-hidden="true" />
                      </div>
                      <span className="text-xs sm:text-sm font-semibold text-blue-900">
                        {copy.prescription.camera.openCameraBtn}
                      </span>
                      <span className="text-[11px] text-slate-500 leading-snug">
                        {copy.prescription.camera.guideHint}
                      </span>
                    </button>
                  </div>

                  {uploadError && (
                    <p className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2">
                      {uploadError}
                    </p>
                  )}

                  {/* Staged Multi-File Preview List */}
                  {stagedFiles.length > 0 && (
                    <div className="space-y-2.5 pt-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-bold text-slate-700">
                          {copy.prescription.selectedFilesTitle} ({stagedFiles.length}/
                          {MAX_FILES_PER_ORDER})
                        </p>
                        {stagedFiles.length < MAX_FILES_PER_ORDER && (
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 cursor-pointer"
                            >
                              <FilePlus2 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>{copy.prescription.addMoreFiles}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setCameraTarget('new')}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 hover:text-sky-900 cursor-pointer"
                            >
                              <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>{copy.prescription.camera.openCameraBtn}</span>
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {stagedFiles.map((file) => (
                          <div
                            key={file.localId}
                            className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200"
                          >
                            <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                              {file.previewUrl ? (
                                <img
                                  src={file.previewUrl}
                                  alt={file.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <FileText className="w-6 h-6 text-rose-600" aria-hidden="true" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1 space-y-0.5">
                              <p className="text-xs font-semibold text-slate-900 truncate">
                                {file.name}
                              </p>
                              <p className="text-[11px] text-slate-500 tabular-nums">
                                {file.fileType.toUpperCase()} · {formatFileSize(file.size)}
                              </p>
                              <div className="flex items-center gap-3 pt-1">
                                <button
                                  type="button"
                                  onClick={() => handlePreviewStaged(file)}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 hover:text-sky-900 cursor-pointer"
                                >
                                  <Eye className="w-3 h-3" aria-hidden="true" />
                                  <span>{copy.prescription.previewFile}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveStaged(file.localId)}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-800 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" aria-hidden="true" />
                                  <span>{copy.prescription.removeFile}</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Patient Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      {copy.prescription.patientName} *
                    </label>
                    <input
                      type="text"
                      required
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      {copy.prescription.phone} *
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 tabular-nums"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      {copy.prescription.address} *
                    </label>
                    <input
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      {copy.prescription.linkedOrderOptional}
                    </label>
                    <input
                      type="text"
                      value={linkedOrderNumber}
                      onChange={(e) => setLinkedOrderNumber(e.target.value)}
                      placeholder={copy.prescription.linkedOrderPlaceholder}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 font-mono-tabular"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    {copy.prescription.notes}
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" />
                    <span>{copy.trust.pharmacistDesc}</span>
                  </div>

                  <button
                    type="submit"
                    disabled={stagedFiles.length === 0 || isSubmitting}
                    className="px-5 py-2.5 min-h-[40px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isSubmitting ? copy.prescription.submitting : copy.prescription.submitBtn}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Prescription Processing Status Tracking & Additional File Upload */}
          <section className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-7 space-y-5">
            <input
              ref={appendFileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif,.pdf,application/pdf"
              onChange={handleAppendFilesSelected}
              className="hidden"
            />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {copy.prescription.recentTitle}
              </h2>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-60">
                  <Search
                    className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder={copy.prescription.searchOrdersPlaceholder}
                    className="w-full ps-8 pe-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
                  />
                </div>
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  <span>{copy.prescription.refreshBtn}</span>
                </button>
              </div>
            </div>

            {onRequestNotificationPermission && onSendTestNotification && (
              <BrowserNotificationPromptBar
                lang={lang}
                permission={notificationPermission}
                onRequestPermission={onRequestNotificationPermission}
                onSendTestAlert={onSendTestNotification}
              />
            )}

            {appendError && (
              <p className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2">
                {appendError}
              </p>
            )}

            {filteredSubmissions.length === 0 ? (
              <div className="py-8 text-center text-xs sm:text-sm text-slate-500">
                {copy.prescription.noOrdersYet}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredSubmissions.map((sub) => {
                  const canAddMore =
                    (sub.status === 'pending_review' ||
                      sub.status === 'under_review' ||
                      sub.status === 'needs_clarification') &&
                    sub.files.length < MAX_FILES_PER_ORDER;

                  return (
                    <article
                      key={sub.id}
                      className="border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3.5 bg-slate-50/40"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="font-mono-tabular text-sm font-bold text-blue-800">
                              {sub.id}
                            </span>
                            {sub.linkedOrderNumber && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono-tabular text-slate-700">
                                  {copy.prescription.linkedOrderLabel}: #{sub.linkedOrderNumber}
                                </span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">
                              {formatTimestamp(sub.submittedAt)}
                            </span>
                          </div>
                          <p className="text-sm font-bold text-slate-900">
                            {sub.patientName}{' '}
                            <span className="font-normal text-slate-500 tabular-nums">
                              · {sub.phone}
                            </span>
                          </p>
                        </div>

                        <PrescriptionStatusIndicator status={sub.status} lang={lang} />
                      </div>

                      {/* 5-Stage Processing Pipeline */}
                      <PrescriptionProgressSteps status={sub.status} lang={lang} />

                      {/* Pharmacist Feedback & Estimated Total */}
                      {(sub.reviewNotes || sub.estimatedTotal !== undefined || sub.reviewedBy) && (
                        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5 text-xs sm:text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            {sub.reviewedBy && (
                              <span className="font-semibold text-slate-800">
                                {copy.prescription.reviewedByLabel}: {sub.reviewedBy}
                              </span>
                            )}
                            {sub.estimatedTotal !== undefined && (
                              <span className="font-bold text-blue-800 tabular-nums">
                                {copy.prescription.estimatedTotalLabel}: {sub.estimatedTotal}{' '}
                                {copy.currency}
                              </span>
                            )}
                          </div>
                          {sub.reviewNotes && (
                            <p className="text-slate-600 leading-relaxed">
                              <span className="font-semibold text-slate-700">
                                {copy.prescription.pharmacistNoteLabel}:{' '}
                              </span>
                              {sub.reviewNotes}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Attached Files for Order */}
                      <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-700 tabular-nums">
                            {copy.prescription.selectedFilesTitle} ({sub.files.length})
                          </p>

                          {canAddMore && (
                            <div className="flex flex-wrap items-center gap-3">
                              <button
                                type="button"
                                disabled={appendingOrderId === sub.id}
                                onClick={() => triggerAppendFiles(sub.id)}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 cursor-pointer"
                              >
                                <FilePlus2 className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>
                                  {appendingOrderId === sub.id
                                    ? copy.prescription.uploadingMore
                                    : copy.prescription.addFilesToExisting}
                                </span>
                              </button>
                              <button
                                type="button"
                                disabled={appendingOrderId === sub.id}
                                onClick={() => setCameraTarget(sub.id)}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 hover:text-sky-900 cursor-pointer"
                              >
                                <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>{copy.prescription.camera.openCameraBtn}</span>
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {sub.files.map((file) => (
                            <div
                              key={file.id}
                              className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white border border-slate-200"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewFile({
                                    name: file.name,
                                    url: file.url,
                                    fileType: file.fileType,
                                    size: file.size,
                                  })
                                }
                                className="w-11 h-11 rounded-lg bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 cursor-pointer"
                              >
                                {file.fileType === 'image' ? (
                                  <img
                                    src={file.url}
                                    alt={file.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <FileText className="w-5 h-5 text-rose-600" aria-hidden="true" />
                                )}
                              </button>

                              <div className="min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewFile({
                                      name: file.name,
                                      url: file.url,
                                      fileType: file.fileType,
                                      size: file.size,
                                    })
                                  }
                                  className="text-xs font-semibold text-slate-900 hover:text-blue-700 truncate block max-w-full text-start cursor-pointer"
                                >
                                  {file.name}
                                </button>
                                <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                  <span className="tabular-nums">{formatFileSize(file.size)}</span>
                                  <span>·</span>
                                  <FileVerificationLabel
                                    status={file.verificationStatus}
                                    lang={lang}
                                  />
                                </div>
                              </div>

                              {canAddMore && sub.files.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteExistingFile(sub.id, file.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer shrink-0"
                                  aria-label={copy.prescription.removeFile}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Latest status audit note */}
                      {sub.statusHistory.length > 0 && (
                        <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                          <span className="truncate">
                            {copy.prescription.timelineTitle}:{' '}
                            {copy.prescription.statuses[
                              sub.statusHistory[sub.statusHistory.length - 1].status
                            ]}
                            {sub.statusHistory[sub.statusHistory.length - 1].actor
                              ? ` · ${sub.statusHistory[sub.statusHistory.length - 1].actor}`
                              : ''}
                          </span>
                          <span className="tabular-nums shrink-0 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" aria-hidden="true" />
                            {formatTimestamp(sub.updatedAt)}
                          </span>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      <PrescriptionFileViewer
        file={previewFile}
        lang={lang}
        onClose={() => setPreviewFile(null)}
      />

      <PrescriptionCameraModal
        isOpen={cameraTarget !== null}
        lang={lang}
        onClose={() => setCameraTarget(null)}
        onCaptureFile={handleCameraCapturedFile}
      />
    </main>
  );
};
