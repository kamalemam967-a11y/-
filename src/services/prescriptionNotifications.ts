import { t } from '../data/translations';
import {
  Language,
  PrescriptionAlert,
  PrescriptionStatus,
} from '../types/pharmacy';

export type BrowserNotificationPermission =
  | 'granted'
  | 'denied'
  | 'default'
  | 'unsupported';

const ALERTS_STORAGE_KEY = 'mar_pharmacy_rx_alerts';
const MAX_STORED_ALERTS = 20;

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return window.Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const result = await window.Notification.requestPermission();
    return result;
  } catch {
    return getBrowserNotificationPermission();
  }
}

export function playNotificationChime() {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, startOffset: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(0.001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.07, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration);
    };

    playTone(587.33, 0, 0.16);
    playTone(880, 0.12, 0.22);

    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 600);
  } catch {
    // ignore audio autoplay restrictions
  }
}

export function dispatchBrowserNotification(options: {
  title: string;
  body: string;
  tag?: string;
  onClick?: () => void;
}): boolean {
  if (getBrowserNotificationPermission() !== 'granted') {
    return false;
  }
  try {
    const notification = new window.Notification(options.title, {
      body: options.body,
      tag: options.tag,
    });
    notification.onclick = () => {
      try {
        window.focus();
      } catch {
        // ignore focus restriction
      }
      options.onClick?.();
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}

export function buildStatusNotificationText(
  lang: Language,
  rxId: string,
  patientName: string,
  newStatus: PrescriptionStatus,
  reviewNotes?: string
): { title: string; body: string } {
  const copy = t(lang);
  const statusLabel = copy.prescription.statuses[newStatus];
  const title = `${copy.brandName} · ${statusLabel}`;
  const notePart = reviewNotes ? ` — ${reviewNotes}` : '';
  const body =
    lang === 'ar'
      ? `الطلب ${rxId} (${patientName}): أصبحت الحالة "${statusLabel}"${notePart}`
      : `Order ${rxId} (${patientName}) is now "${statusLabel}"${notePart}`;
  return { title, body };
}

export function loadSavedAlerts(): PrescriptionAlert[] {
  try {
    const raw = localStorage.getItem(ALERTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PrescriptionAlert[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_STORED_ALERTS) : [];
  } catch {
    return [];
  }
}

export function saveAlerts(alerts: PrescriptionAlert[]) {
  try {
    localStorage.setItem(
      ALERTS_STORAGE_KEY,
      JSON.stringify(alerts.slice(0, MAX_STORED_ALERTS))
    );
  } catch {
    // ignore storage errors
  }
}
