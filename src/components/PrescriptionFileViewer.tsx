import React, { useState } from 'react';
import {
  Download,
  ExternalLink,
  FileText,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { t } from '../data/translations';
import { Language } from '../types/pharmacy';
import { formatFileSize } from '../services/prescriptionApi';

export interface PreviewableFile {
  name: string;
  url: string;
  fileType: 'image' | 'pdf';
  size?: number;
}

interface PrescriptionFileViewerProps {
  file: PreviewableFile | null;
  lang: Language;
  onClose: () => void;
}

export const PrescriptionFileViewer: React.FC<PrescriptionFileViewerProps> = ({
  file,
  lang,
  onClose,
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const copy = t(lang);

  if (!file) return null;

  const handleClose = () => {
    setZoom(1);
    setRotation(0);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        className="relative z-10 w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={file.name}
      >
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50">
          <div className="min-w-0 flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-blue-700 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{file.name}</p>
              {file.size !== undefined && (
                <p className="text-xs text-slate-500 tabular-nums">
                  {file.fileType.toUpperCase()} · {formatFileSize(file.size)}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {file.fileType === 'image' ? (
              <>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                  className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                  aria-label={copy.prescription.zoomOut}
                  title={copy.prescription.zoomOut}
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
                  className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                  aria-label={copy.prescription.zoomIn}
                  title={copy.prescription.zoomIn}
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                  aria-label={copy.prescription.rotate}
                  title={copy.prescription.rotate}
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </>
            ) : (
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 text-xs font-semibold whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{copy.prescription.openPdfNewTab}</span>
              </a>
            )}

            <a
              href={file.url}
              download={file.name}
              className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 flex items-center justify-center"
              aria-label={copy.prescription.downloadFile}
              title={copy.prescription.downloadFile}
            >
              <Download className="w-4 h-4" />
            </a>

            <button
              type="button"
              onClick={handleClose}
              className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              aria-label={copy.prescription.closePreview}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-100 flex items-center justify-center p-4 min-h-[380px]">
          {file.fileType === 'image' ? (
            <div className="overflow-auto max-w-full max-h-[72vh] flex items-center justify-center">
              <img
                src={file.url}
                alt={file.name}
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: 'center center',
                }}
                className="max-w-full max-h-[68vh] object-contain rounded-xl border border-slate-200 bg-white transition-transform duration-150"
              />
            </div>
          ) : (
            <iframe
              src={file.url}
              title={file.name}
              className="w-full h-[70vh] rounded-xl border border-slate-200 bg-white"
            />
          )}
        </div>
      </div>
    </div>
  );
};
