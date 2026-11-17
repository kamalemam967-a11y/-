import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BellOff,
  BellRing,
  CheckCheck,
  Trash2,
  X,
} from 'lucide-react';
import { t } from '../data/translations';
import { BrowserNotificationPermission } from '../services/prescriptionNotifications';
import { Language, PrescriptionAlert } from '../types/pharmacy';
import { PrescriptionStatusIndicator } from './PrescriptionStatusBadge';

interface NotificationBellProps {
  lang: Language;
  alerts: PrescriptionAlert[];
  permission: BrowserNotificationPermission;
  onRequestPermission: () => Promise<void> | void;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onClearAll: () => void;
  onSelectAlert: (alert: PrescriptionAlert) => void;
  onSendTestAlert: () => void;
}

export const NotificationBellButton: React.FC<NotificationBellProps> = ({
  lang,
  alerts,
  permission,
  onRequestPermission,
  onMarkAllRead,
  onMarkRead,
  onClearAll,
  onSelectAlert,
  onSendTestAlert,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const copy = t(lang);
  const nCopy = copy.prescription.notifications;

  const unreadCount = alerts.filter((a) => !a.read).length;

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        aria-label={nCopy.bellLabel}
        aria-expanded={open}
      >
        {permission === 'denied' ? (
          <BellOff className="w-4 h-4 text-slate-500" aria-hidden="true" />
        ) : unreadCount > 0 ? (
          <BellRing className="w-4 h-4 text-blue-700" aria-hidden="true" />
        ) : (
          <Bell className="w-4 h-4" aria-hidden="true" />
        )}

        {unreadCount > 0 && (
          <span className="absolute -top-1 -end-1 min-w-[17px] h-[17px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold font-mono-tabular flex items-center justify-center border border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute end-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-white border border-slate-200/90 rounded-2xl shadow-xl overflow-hidden z-50"
          role="region"
          aria-label={nCopy.panelTitle}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50/70">
            <div className="flex items-center gap-2 min-w-0">
              <Bell className="w-3.5 h-3.5 text-blue-700 shrink-0" aria-hidden="true" />
              <h3 className="text-xs font-bold text-slate-900 truncate">
                {nCopy.panelTitle}
              </h3>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                >
                  <CheckCheck className="w-3 h-3" aria-hidden="true" />
                  <span>{nCopy.markAllRead}</span>
                </button>
              )}
              {alerts.length > 0 && (
                <button
                  type="button"
                  onClick={onClearAll}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-rose-600 cursor-pointer"
                  aria-label={nCopy.clearAll}
                >
                  <Trash2 className="w-3 h-3" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* Browser Notification Permission Bar */}
          <div className="px-4 py-2.5 border-b border-slate-100 bg-blue-50/50">
            {permission === 'default' ? (
              <div className="flex items-center justify-between gap-2.5">
                <p className="text-[11px] text-slate-700 leading-snug">
                  {nCopy.enableBannerDesc}
                </p>
                <button
                  type="button"
                  onClick={() => void onRequestPermission()}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {nCopy.enableBtn}
                </button>
              </div>
            ) : permission === 'granted' ? (
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-semibold text-blue-800 inline-flex items-center gap-1">
                  <BellRing className="w-3 h-3" aria-hidden="true" />
                  {nCopy.enabledStatus}
                </span>
                <button
                  type="button"
                  onClick={onSendTestAlert}
                  className="text-[11px] font-semibold text-sky-700 hover:text-sky-900 cursor-pointer"
                >
                  {nCopy.testBtn}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600">
                <span className="leading-snug">
                  {permission === 'denied' ? nCopy.blockedStatus : nCopy.unsupportedStatus}
                </span>
                <button
                  type="button"
                  onClick={onSendTestAlert}
                  className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {nCopy.testBtn}
                </button>
              </div>
            )}
          </div>

          {/* Alerts List */}
          {alerts.length === 0 ? (
            <div className="p-6 text-center space-y-1">
              <p className="text-xs font-semibold text-slate-700">{nCopy.emptyTitle}</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">{nCopy.emptyDesc}</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {alerts.map((alert) => (
                <li key={alert.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onMarkRead(alert.id);
                      onSelectAlert(alert);
                      setOpen(false);
                    }}
                    className={`w-full text-start px-4 py-3 transition-colors cursor-pointer space-y-1.5 ${
                      alert.read ? 'bg-white hover:bg-slate-50' : 'bg-blue-50/45 hover:bg-blue-50/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-tabular text-xs font-bold text-blue-800">
                        {alert.rxId}
                      </span>
                      <span className="text-[10px] text-slate-400 tabular-nums">
                        {formatTime(alert.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-medium text-slate-800 truncate">
                        {alert.patientName}
                      </span>
                      <PrescriptionStatusIndicator status={alert.newStatus} lang={lang} />
                    </div>
                    {alert.reviewNotes && (
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-snug">
                        {alert.reviewNotes}
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

interface NotificationToastStackProps {
  lang: Language;
  toasts: PrescriptionAlert[];
  onDismissToast: (id: string) => void;
  onTrackOrder: (alert: PrescriptionAlert) => void;
}

export const NotificationToastStack: React.FC<NotificationToastStackProps> = ({
  lang,
  toasts,
  onDismissToast,
  onTrackOrder,
}) => {
  if (toasts.length === 0) return null;
  const copy = t(lang);
  const nCopy = copy.prescription.notifications;

  return (
    <div
      className="fixed bottom-20 start-4 sm:start-6 z-40 w-[calc(100vw-2rem)] max-w-sm space-y-2.5 pointer-events-none"
      aria-live="polite"
    >
      {toasts.slice(0, 3).map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="pointer-events-auto bg-white border border-blue-200/90 rounded-2xl shadow-lg p-3.5 space-y-2"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center shrink-0">
                <BellRing className="w-3.5 h-3.5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {nCopy.toastTitlePrefix}
                </p>
                <p className="text-[11px] text-slate-500 font-mono-tabular truncate">
                  {toast.rxId} · {toast.patientName}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onDismissToast(toast.id)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
              aria-label={nCopy.dismissBtn}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
            <PrescriptionStatusIndicator status={toast.newStatus} lang={lang} />
            <button
              type="button"
              onClick={() => onTrackOrder(toast)}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer whitespace-nowrap"
            >
              {nCopy.viewOrderBtn}
            </button>
          </div>

          {toast.reviewNotes && (
            <p className="text-[11px] text-slate-600 line-clamp-2 leading-snug border-t border-slate-100 pt-1.5">
              {toast.reviewNotes}
            </p>
          )}
        </div>
      ))}
    </div>
  );
};

interface BrowserNotificationPromptBarProps {
  lang: Language;
  permission: BrowserNotificationPermission;
  onRequestPermission: () => Promise<void> | void;
  onSendTestAlert: () => void;
}

export const BrowserNotificationPromptBar: React.FC<BrowserNotificationPromptBarProps> = ({
  lang,
  permission,
  onRequestPermission,
  onSendTestAlert,
}) => {
  const copy = t(lang);
  const nCopy = copy.prescription.notifications;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-blue-200/80 bg-blue-50/55 px-4 py-3">
      <div className="flex items-start sm:items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-white border border-blue-100 text-blue-700 flex items-center justify-center shrink-0">
          <BellRing className="w-4 h-4" aria-hidden="true" />
        </div>
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-slate-900">{nCopy.enableBannerTitle}</p>
          <p className="text-[11px] text-slate-600 leading-snug">
            {permission === 'granted'
              ? nCopy.enabledStatus
              : permission === 'denied'
                ? nCopy.blockedStatus
                : permission === 'unsupported'
                  ? nCopy.unsupportedStatus
                  : nCopy.enableBannerDesc}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
        {permission === 'default' && (
          <button
            type="button"
            onClick={() => void onRequestPermission()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 min-h-[34px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <BellRing className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{nCopy.enableBtn}</span>
          </button>
        )}
        <button
          type="button"
          onClick={onSendTestAlert}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-xl border border-blue-200 bg-white hover:bg-blue-50 text-blue-800 text-xs font-semibold cursor-pointer whitespace-nowrap"
        >
          <span>{nCopy.testBtn}</span>
        </button>
      </div>
    </div>
  );
};
