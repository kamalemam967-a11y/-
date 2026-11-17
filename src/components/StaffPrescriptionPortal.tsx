import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  KeyRound,
  Lock,
  LogOut,
  Maximize2,
  Package,
  PackagePlus,
  Search,
  ShieldCheck,
  Stethoscope,
  Store,
  Truck,
  XCircle,
} from 'lucide-react';
import { t } from '../data/translations';
import {
  formatFileSize,
  getStoredStaffSession,
  loginStaffPortal,
  logoutStaffPortal,
  reviewPrescription,
  StaffSessionInfo,
  verifyStaffSession,
} from '../services/prescriptionApi';
import {
  Language,
  PrescriptionFile,
  PrescriptionFileStatus,
  PrescriptionStatus,
  PrescriptionSubmission,
  Product,
} from '../types/pharmacy';
import { PreviewableFile, PrescriptionFileViewer } from './PrescriptionFileViewer';
import {
  FileVerificationLabel,
  PrescriptionStatusIndicator,
} from './PrescriptionStatusBadge';
import { StaffAddProductModal } from './StaffAddProductModal';

interface StaffPrescriptionPortalProps {
  lang: Language;
  submissions: PrescriptionSubmission[];
  onOrderUpdated: (updated: PrescriptionSubmission) => void;
  customProducts?: Product[];
  onProductAdded?: (product: Product) => void;
  onProductDeleted?: (productId: string) => void;
}

type FilterTab = 'all' | PrescriptionStatus;

export const StaffPrescriptionPortal: React.FC<StaffPrescriptionPortalProps> = ({
  lang,
  submissions,
  onOrderUpdated,
  customProducts = [],
  onProductAdded,
  onProductDeleted,
}) => {
  const copy = t(lang);
  const [statusFilter, setStatusFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    submissions[0]?.id ?? null
  );
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [modalFile, setModalFile] = useState<PreviewableFile | null>(null);

  const [pharmacistName, setPharmacistName] = useState<string>(
    copy.prescription.staff.defaultPharmacist
  );
  const [reviewNotes, setReviewNotes] = useState('');
  const [estimatedTotal, setEstimatedTotal] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [staffSession, setStaffSession] = useState<StaffSessionInfo | null>(() =>
    getStoredStaffSession()
  );
  const [loginName, setLoginName] = useState('');
  const [loginPasscode, setLoginPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);

  useEffect(() => {
    let active = true;
    if (getStoredStaffSession()) {
      void verifyStaffSession().then((verified) => {
        if (!active) return;
        if (!verified) {
          setStaffSession(null);
          setAuthError(copy.prescription.staff.authExpiredError);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [copy.prescription.staff.authExpiredError]);

  const counts = useMemo(() => {
    return {
      pending: submissions.filter((s) => s.status === 'pending_review').length,
      inReview: submissions.filter((s) => s.status === 'under_review').length,
      clarification: submissions.filter((s) => s.status === 'needs_clarification').length,
      approvedReady: submissions.filter(
        (s) =>
          s.status === 'approved' ||
          s.status === 'preparing' ||
          s.status === 'ready_for_pickup' ||
          s.status === 'out_for_delivery' ||
          s.status === 'ready_for_delivery'
      ).length,
    };
  }, [submissions]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return submissions.filter((sub) => {
      if (statusFilter !== 'all' && sub.status !== statusFilter) return false;
      if (!q) return true;
      return (
        sub.id.toLowerCase().includes(q) ||
        sub.patientName.toLowerCase().includes(q) ||
        sub.phone.toLowerCase().includes(q) ||
        (sub.linkedOrderNumber && sub.linkedOrderNumber.toLowerCase().includes(q))
      );
    });
  }, [submissions, statusFilter, searchQuery]);

  const selectedOrder = useMemo(() => {
    return (
      filteredOrders.find((o) => o.id === selectedOrderId) ||
      submissions.find((o) => o.id === selectedOrderId) ||
      filteredOrders[0] ||
      null
    );
  }, [filteredOrders, submissions, selectedOrderId]);

  useEffect(() => {
    if (selectedOrder) {
      setReviewNotes(selectedOrder.reviewNotes || '');
      setEstimatedTotal(
        selectedOrder.estimatedTotal !== undefined ? String(selectedOrder.estimatedTotal) : ''
      );
      setActiveFileId(selectedOrder.files[0]?.id ?? null);
      setActionError(null);
    }
  }, [selectedOrder?.id]);

  const activeFile: PrescriptionFile | null = useMemo(() => {
    if (!selectedOrder || selectedOrder.files.length === 0) return null;
    return (
      selectedOrder.files.find((f) => f.id === activeFileId) || selectedOrder.files[0]
    );
  }, [selectedOrder, activeFileId]);

  const handleStatusDecision = async (nextStatus: PrescriptionStatus) => {
    if (!selectedOrder || isSaving) return;
    setIsSaving(true);
    setActionError(null);
    try {
      const parsedTotal = estimatedTotal.trim() ? Number(estimatedTotal.trim()) : null;
      const updated = await reviewPrescription(selectedOrder.id, {
        status: nextStatus,
        reviewedBy: pharmacistName.trim() || copy.prescription.staff.defaultPharmacist,
        reviewNotes: reviewNotes.trim(),
        estimatedTotal:
          parsedTotal !== null && Number.isFinite(parsedTotal) ? parsedTotal : null,
      });
      onOrderUpdated(updated);
    } catch (err) {
      if (err instanceof Error && err.message === 'STAFF_AUTH_REQUIRED') {
        setStaffSession(null);
        setAuthError(copy.prescription.staff.authExpiredError);
      } else {
        setActionError(err instanceof Error ? err.message : copy.prescription.submitError);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileVerification = async (
    fileId: string,
    verificationStatus: PrescriptionFileStatus
  ) => {
    if (!selectedOrder || isSaving) return;
    setIsSaving(true);
    setActionError(null);
    try {
      const updated = await reviewPrescription(selectedOrder.id, {
        reviewedBy: pharmacistName.trim() || copy.prescription.staff.defaultPharmacist,
        fileUpdates: [{ fileId, verificationStatus }],
      });
      onOrderUpdated(updated);
    } catch (err) {
      if (err instanceof Error && err.message === 'STAFF_AUTH_REQUIRED') {
        setStaffSession(null);
        setAuthError(copy.prescription.staff.authExpiredError);
      } else {
        setActionError(err instanceof Error ? err.message : copy.prescription.submitError);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginName.trim() || !loginPasscode.trim() || isAuthenticating) return;
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const session = await loginStaffPortal(loginName.trim(), loginPasscode.trim());
      setStaffSession(session);
      setLoginPasscode('');
    } catch {
      setAuthError(copy.prescription.staff.authInvalidError);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleStaffLogout = async () => {
    await logoutStaffPortal();
    setStaffSession(null);
    setAuthError(null);
    setLoginPasscode('');
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

  if (!staffSession) {
    return (
      <div className="max-w-md mx-auto py-4 sm:py-8">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-7 shadow-xs space-y-5">
          <div className="text-center space-y-2.5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center mx-auto">
              <Lock className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-900">
                {copy.prescription.staff.authTitle}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {copy.prescription.staff.authSubtitle}
              </p>
            </div>
          </div>

          <form onSubmit={handleStaffLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="staff-login-name"
                className="block text-xs font-semibold text-slate-700"
              >
                {copy.prescription.staff.authNameLabel}
              </label>
              <input
                id="staff-login-name"
                type="text"
                required
                autoComplete="username"
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                placeholder={copy.prescription.staff.authNamePlaceholder}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="staff-login-code"
                className="block text-xs font-semibold text-slate-700"
              >
                {copy.prescription.staff.authCodeLabel}
              </label>
              <div className="relative">
                <input
                  id="staff-login-code"
                  type={showPasscode ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={loginPasscode}
                  onChange={(e) => setLoginPasscode(e.target.value)}
                  placeholder={copy.prescription.staff.authCodePlaceholder}
                  className="w-full ps-3.5 pe-10 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white font-mono-tabular"
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode((prev) => !prev)}
                  className="absolute top-1/2 -translate-y-1/2 end-2.5 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                  aria-label={showPasscode ? 'Hide passcode' : 'Show passcode'}
                >
                  {showPasscode ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {authError && (
              <p className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={isAuthenticating || !loginName.trim() || !loginPasscode.trim()}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 min-h-[40px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              <KeyRound className="w-4 h-4" aria-hidden="true" />
              <span>
                {isAuthenticating
                  ? copy.prescription.staff.authChecking
                  : copy.prescription.staff.authSubmitBtn}
              </span>
            </button>
          </form>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
            <span>{copy.brandName}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Staff Portal Header */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
              <Stethoscope className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{copy.prescription.staffTab}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              {copy.prescription.staff.title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
              {copy.prescription.staff.subtitle}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-2.5">
            <div className="sm:w-56 space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                {copy.prescription.staff.pharmacistNameLabel}
              </label>
              <input
                type="text"
                value={pharmacistName}
                onChange={(e) => setPharmacistName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
              />
            </div>

            <button
              type="button"
              onClick={() => setIsAddProductOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 min-h-[36px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
            >
              <PackagePlus className="w-4 h-4" aria-hidden="true" />
              <span>
                {lang === 'ar' ? 'إضافة صنف / دواء' : 'Add Product / Medicine'}
                {customProducts.length > 0 ? ` (${customProducts.length})` : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={() => void handleStaffLogout()}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-xl border border-slate-200 bg-slate-50 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 text-xs font-semibold text-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title={`${copy.prescription.staff.authSignedInAs} ${staffSession.pharmacistName}`}
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{copy.prescription.staff.authLockBtn}</span>
            </button>
          </div>
        </div>

        {/* 4-Column Queue KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/75 space-y-0.5">
            <p className="text-[11px] font-medium text-amber-900">
              {copy.prescription.staff.kpiPending}
            </p>
            <p className="text-xl font-bold text-amber-950 font-mono-tabular">
              {counts.pending}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200/75 space-y-0.5">
            <p className="text-[11px] font-medium text-sky-900">
              {copy.prescription.staff.kpiInReview}
            </p>
            <p className="text-xl font-bold text-sky-950 font-mono-tabular">
              {counts.inReview}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-orange-50/70 border border-orange-200/75 space-y-0.5">
            <p className="text-[11px] font-medium text-orange-900">
              {copy.prescription.staff.kpiClarification}
            </p>
            <p className="text-xl font-bold text-orange-950 font-mono-tabular">
              {counts.clarification}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/75 space-y-0.5">
            <p className="text-[11px] font-medium text-blue-900">
              {copy.prescription.staff.kpiApprovedReady}
            </p>
            <p className="text-xl font-bold text-blue-950 font-mono-tabular">
              {counts.approvedReady}
            </p>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto no-scrollbar">
            {(
              [
                ['all', copy.prescription.staff.allFilter],
                ['pending_review', copy.prescription.statuses.pending_review],
                ['under_review', copy.prescription.statuses.under_review],
                ['needs_clarification', copy.prescription.statuses.needs_clarification],
                ['approved', copy.prescription.statuses.approved],
                ['preparing', copy.prescription.statuses.preparing],
                ['ready_for_pickup', copy.prescription.statuses.ready_for_pickup],
                ['out_for_delivery', copy.prescription.statuses.out_for_delivery],
                ['rejected', copy.prescription.statuses.rejected],
              ] as [FilterTab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  statusFilter === key
                    ? 'bg-white text-blue-800 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative lg:w-72">
            <Search
              className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={copy.prescription.searchOrdersPlaceholder}
              className="w-full ps-9 pe-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>
      </div>

      {/* Main 2-Column Staff Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Queue Column */}
        <section className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900">
              {copy.prescription.staff.queueTitle}
            </h3>
            <span className="text-xs text-slate-500 font-mono-tabular">
              {filteredOrders.length}
            </span>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="p-6 text-center text-xs sm:text-sm text-slate-500">
              {copy.prescription.noOrdersYet}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[680px] overflow-y-auto">
              {filteredOrders.map((order) => {
                const isSelected = selectedOrder?.id === order.id;
                const pdfCount = order.files.filter((f) => f.fileType === 'pdf').length;
                const imgCount = order.files.length - pdfCount;

                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`w-full text-start p-3.5 transition-colors cursor-pointer space-y-2 ${
                      isSelected
                        ? 'bg-blue-50/70'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono-tabular text-sm font-bold text-blue-800">
                            {order.id}
                          </span>
                          {order.linkedOrderNumber && (
                            <span className="font-mono-tabular text-xs text-slate-500">
                              · #{order.linkedOrderNumber}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-slate-900 truncate mt-0.5">
                          {order.patientName}
                        </p>
                      </div>
                      <PrescriptionStatusIndicator status={order.status} lang={lang} />
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="tabular-nums">
                        {order.files.length}{' '}
                        {order.files.length === 1
                          ? copy.prescription.fileSingle
                          : copy.prescription.filesCount}
                        {imgCount > 0 || pdfCount > 0
                          ? ` (${[
                              imgCount > 0 ? `${imgCount} IMG` : '',
                              pdfCount > 0 ? `${pdfCount} PDF` : '',
                            ]
                              .filter(Boolean)
                              .join(', ')})`
                          : ''}
                      </span>
                      <span className="tabular-nums">{formatTimestamp(order.submittedAt)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Active Inspection & Approval Column */}
        <section className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-5">
          {!selectedOrder ? (
            <div className="py-12 text-center text-xs sm:text-sm text-slate-500">
              {copy.prescription.staff.selectPrompt}
            </div>
          ) : (
            <>
              {/* Selected Order Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono-tabular text-base font-bold text-blue-800">
                      {selectedOrder.id}
                    </span>
                    {selectedOrder.linkedOrderNumber && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular font-medium text-slate-700">
                          {copy.prescription.linkedOrderLabel}: #{selectedOrder.linkedOrderNumber}
                        </span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {formatTimestamp(selectedOrder.submittedAt)}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {selectedOrder.patientName}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 tabular-nums">
                    {selectedOrder.phone} · {selectedOrder.address}
                  </p>
                  {selectedOrder.notes && (
                    <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3 mt-2">
                      {selectedOrder.notes}
                    </p>
                  )}
                </div>
                <PrescriptionStatusIndicator status={selectedOrder.status} lang={lang} />
              </div>

              {/* Linked Cart Items if Submitted from Storefront Checkout */}
              {selectedOrder.linkedItems && selectedOrder.linkedItems.length > 0 && (
                <div className="bg-sky-50/70 border border-sky-200/80 rounded-2xl p-4 space-y-2">
                  <h4 className="text-xs font-bold text-sky-950">
                    {copy.prescription.staff.linkedItemsTitle}
                  </h4>
                  <ul className="divide-y divide-sky-200/60 text-xs">
                    {selectedOrder.linkedItems.map((item) => (
                      <li
                        key={item.productId}
                        className="py-1.5 flex items-center justify-between gap-2"
                      >
                        <span className="text-slate-800 font-medium">
                          {lang === 'ar' ? item.nameAr : item.nameEn} ×{' '}
                          <span className="tabular-nums">{item.quantity}</span>
                          {item.requiresPrescription ? ' (Rx)' : ''}
                        </span>
                        <span className="font-mono-tabular text-slate-700">
                          {item.price * item.quantity} {copy.currency}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Files Selector + Live Inline Document Inspector */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900">
                    {copy.prescription.staff.filesGalleryTitle} ({selectedOrder.files.length})
                  </h4>
                </div>

                {/* Multi-file switcher */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedOrder.files.map((file) => {
                    const isActive = activeFile?.id === file.id;
                    return (
                      <div
                        key={file.id}
                        className={`p-3 rounded-2xl border transition-colors space-y-2.5 ${
                          isActive
                            ? 'bg-blue-50/60 border-blue-300'
                            : 'bg-slate-50/70 border-slate-200'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveFileId(file.id)}
                          className="w-full flex items-center gap-3 text-start cursor-pointer"
                        >
                          <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                            {file.fileType === 'image' ? (
                              <img
                                src={file.url}
                                alt={file.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <FileText className="w-5 h-5 text-rose-600" aria-hidden="true" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-900 truncate">
                              {file.name}
                            </p>
                            <p className="text-[11px] text-slate-500 tabular-nums">
                              {file.fileType.toUpperCase()} · {formatFileSize(file.size)}
                            </p>
                            <div className="mt-1">
                              <FileVerificationLabel
                                status={file.verificationStatus}
                                lang={lang}
                              />
                            </div>
                          </div>
                        </button>

                        <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200/70">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleFileVerification(file.id, 'verified')}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-white border border-blue-200 hover:bg-blue-50 text-blue-800 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                          >
                            {copy.prescription.staff.verifyFileBtn}
                          </button>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleFileVerification(file.id, 'unclear')}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-white border border-orange-200 hover:bg-orange-50 text-orange-800 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                          >
                            {copy.prescription.staff.flagUnclearBtn}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Inline Active File Preview Box */}
                {activeFile && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-100/80 overflow-hidden">
                    <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {activeFile.fileType === 'image' ? (
                          <ImageIcon className="w-4 h-4 text-blue-700 shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span className="text-xs font-semibold text-slate-800 truncate">
                          {activeFile.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {activeFile.fileType === 'pdf' && (
                          <a
                            href={activeFile.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-900 whitespace-nowrap"
                          >
                            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>{copy.prescription.openPdfNewTab}</span>
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setModalFile({
                              name: activeFile.name,
                              url: activeFile.url,
                              fileType: activeFile.fileType,
                              size: activeFile.size,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
                        >
                          <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{copy.prescription.previewFile}</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-3 flex items-center justify-center min-h-[260px] max-h-[380px] overflow-auto">
                      {activeFile.fileType === 'image' ? (
                        <img
                          src={activeFile.url}
                          alt={activeFile.name}
                          className="max-h-[350px] w-auto object-contain rounded-xl border border-slate-200 bg-white"
                        />
                      ) : (
                        <iframe
                          src={activeFile.url}
                          title={activeFile.name}
                          className="w-full h-[340px] rounded-xl border border-slate-200 bg-white"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Pharmacist Review Form & Status Controls */}
              <div className="border-t border-slate-200 pt-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      {copy.prescription.staff.reviewNotesLabel}
                    </label>
                    <textarea
                      rows={3}
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder={copy.prescription.staff.reviewNotesPlaceholder}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      {copy.prescription.staff.estimatedPriceLabel}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={estimatedTotal}
                      onChange={(e) => setEstimatedTotal(e.target.value)}
                      placeholder="350"
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 tabular-nums"
                    />
                  </div>
                </div>

                {actionError && (
                  <p className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                    {actionError}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleStatusDecision('under_review')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-900 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{copy.prescription.staff.startReviewBtn}</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleStatusDecision('approved')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 min-h-[36px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{copy.prescription.staff.approveBtn}</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleStatusDecision('preparing')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Package className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{copy.prescription.staff.prepareBtn}</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleStatusDecision('ready_for_pickup')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-xl border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Store className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{copy.prescription.staff.pickupReadyBtn}</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleStatusDecision('out_for_delivery')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-xl border border-sky-300 bg-sky-100/80 hover:bg-sky-200/70 text-sky-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Truck className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{copy.prescription.staff.outForDeliveryBtn}</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleStatusDecision('needs_clarification')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-xl border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-900 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{copy.prescription.staff.clarifyBtn}</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleStatusDecision('rejected')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-900 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{copy.prescription.staff.rejectBtn}</span>
                  </button>
                </div>
              </div>

              {/* Processing Status Audit History */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-700">
                  {copy.prescription.timelineTitle}
                </h4>
                <ol className="space-y-2.5">
                  {selectedOrder.statusHistory.map((ev, index) => (
                    <li
                      key={`${ev.timestamp}-${index}`}
                      className="flex items-start justify-between gap-3 text-xs border border-slate-100 bg-slate-50/60 rounded-xl p-3"
                    >
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900">
                            {copy.prescription.statuses[ev.status]}
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-600">{ev.actor}</span>
                        </div>
                        {ev.note && <p className="text-slate-600">{ev.note}</p>}
                      </div>
                      <span className="text-slate-500 tabular-nums whitespace-nowrap shrink-0 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" aria-hidden="true" />
                        {formatTimestamp(ev.timestamp)}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}
        </section>
      </div>

      <PrescriptionFileViewer
        file={modalFile}
        lang={lang}
        onClose={() => setModalFile(null)}
      />

      <StaffAddProductModal
        isOpen={isAddProductOpen}
        lang={lang}
        customProducts={customProducts}
        onClose={() => setIsAddProductOpen(false)}
        onProductAdded={(product) => onProductAdded?.(product)}
        onProductDeleted={(id) => onProductDeleted?.(id)}
        onAuthRequired={() => {
          setStaffSession(null);
          setAuthError(copy.prescription.staff.authExpiredError);
        }}
      />
    </div>
  );
};
