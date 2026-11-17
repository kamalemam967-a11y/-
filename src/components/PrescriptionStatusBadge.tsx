import React from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  Package,
  Store,
  Truck,
  XCircle,
} from 'lucide-react';
import { t } from '../data/translations';
import { Language, PrescriptionFileStatus, PrescriptionStatus } from '../types/pharmacy';

interface StatusStyle {
  container: string;
  Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

const STATUS_STYLES: Record<PrescriptionStatus, StatusStyle> = {
  pending_review: {
    container: 'bg-amber-50 border-amber-200 text-amber-900',
    Icon: Clock,
  },
  under_review: {
    container: 'bg-sky-50 border-sky-200 text-sky-900',
    Icon: Eye,
  },
  approved: {
    container: 'bg-blue-50 border-blue-200 text-blue-900',
    Icon: CheckCircle2,
  },
  needs_clarification: {
    container: 'bg-orange-50 border-orange-200 text-orange-900',
    Icon: AlertTriangle,
  },
  rejected: {
    container: 'bg-rose-50 border-rose-200 text-rose-900',
    Icon: XCircle,
  },
  preparing: {
    container: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    Icon: Package,
  },
  ready_for_pickup: {
    container: 'bg-blue-50 border-blue-300 text-blue-900',
    Icon: Store,
  },
  out_for_delivery: {
    container: 'bg-sky-100/90 border-sky-300 text-sky-950',
    Icon: Truck,
  },
  ready_for_delivery: {
    container: 'bg-blue-100/90 border-blue-300 text-blue-950',
    Icon: Truck,
  },
};

export const PrescriptionStatusIndicator: React.FC<{
  status: PrescriptionStatus;
  lang: Language;
}> = ({ status, lang }) => {
  const copy = t(lang);
  const style = STATUS_STYLES[status];
  const { Icon } = style;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold whitespace-nowrap shrink-0 ${style.container}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden={true} />
      <span>{copy.prescription.statuses[status]}</span>
    </span>
  );
};

export const FileVerificationLabel: React.FC<{
  status: PrescriptionFileStatus;
  lang: Language;
}> = ({ status, lang }) => {
  const copy = t(lang);
  if (status === 'verified') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden={true} />
        <span>{copy.prescription.fileStatuses.verified}</span>
      </span>
    );
  }
  if (status === 'unclear') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden={true} />
        <span>{copy.prescription.fileStatuses.unclear}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 whitespace-nowrap">
      <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden={true} />
      <span>{copy.prescription.fileStatuses.pending}</span>
    </span>
  );
};

const PIPELINE_STEPS: PrescriptionStatus[] = [
  'pending_review',
  'under_review',
  'approved',
  'preparing',
  'ready_for_delivery',
];

export const PrescriptionProgressSteps: React.FC<{
  status: PrescriptionStatus;
  lang: Language;
}> = ({ status, lang }) => {
  const copy = t(lang);

  if (status === 'needs_clarification' || status === 'rejected') {
    const isRejected = status === 'rejected';
    return (
      <div
        className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-medium ${
          isRejected
            ? 'bg-rose-50 border-rose-200 text-rose-900'
            : 'bg-orange-50 border-orange-200 text-orange-900'
        }`}
      >
        {isRejected ? (
          <XCircle className="w-4 h-4 shrink-0" aria-hidden={true} />
        ) : (
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden={true} />
        )}
        <span>{copy.prescription.statuses[status]}</span>
      </div>
    );
  }

  const isFulfilledStage =
    status === 'ready_for_pickup' ||
    status === 'out_for_delivery' ||
    status === 'ready_for_delivery';
  const currentIdx = isFulfilledStage ? 4 : PIPELINE_STEPS.indexOf(status);

  return (
    <ol className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      {PIPELINE_STEPS.map((stepKey, idx) => {
        const isDone = idx < currentIdx || (idx === currentIdx && isFulfilledStage);
        const isCurrent = idx === currentIdx && !isFulfilledStage;
        const displayLabel =
          idx === 4 && isFulfilledStage
            ? copy.prescription.statuses[status]
            : copy.prescription.statuses[stepKey];

        return (
          <li
            key={stepKey}
            className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs transition-colors ${
              isDone
                ? 'bg-blue-50/80 border-blue-200 text-blue-900 font-semibold'
                : isCurrent
                  ? 'bg-sky-50 border-sky-300 text-sky-950 font-semibold'
                  : 'bg-slate-50 border-slate-200 text-slate-400'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-mono-tabular shrink-0 ${
                isDone
                  ? 'bg-blue-600 text-white'
                  : isCurrent
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-200 text-slate-600'
              }`}
            >
              {isDone ? <Check className="w-3 h-3" aria-hidden={true} /> : idx + 1}
            </span>
            <span className="leading-tight line-clamp-2">{displayLabel}</span>
          </li>
        );
      })}
    </ol>
  );
};
