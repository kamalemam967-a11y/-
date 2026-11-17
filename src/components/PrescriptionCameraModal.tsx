import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Plus,
  RefreshCw,
  RotateCcw,
  SwitchCamera,
  X,
} from 'lucide-react';
import { t } from '../data/translations';
import { Language } from '../types/pharmacy';

interface PrescriptionCameraModalProps {
  isOpen: boolean;
  lang: Language;
  onClose: () => void;
  onCaptureFile: (file: File) => Promise<void> | void;
}

export const PrescriptionCameraModal: React.FC<PrescriptionCameraModalProps> = ({
  isOpen,
  lang,
  onClose,
  onCaptureFile,
}) => {
  const copy = t(lang);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeInputRef = useRef<HTMLInputElement>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isStarting, setIsStarting] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(
    async (mode: 'environment' | 'user') => {
      stopStream();
      setIsStarting(true);
      setCameraError(false);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setIsStarting(false);
        setCameraError(true);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1600 },
            height: { ideal: 1200 },
          },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraError(false);
      } catch {
        setCameraError(true);
      } finally {
        setIsStarting(false);
      }
    },
    [stopStream]
  );

  useEffect(() => {
    if (isOpen && !capturedDataUrl) {
      void startCamera(facingMode);
    }
    if (!isOpen) {
      stopStream();
      setCapturedDataUrl(null);
      setCameraError(false);
    }
    return () => {
      stopStream();
    };
  }, [isOpen, facingMode, capturedDataUrl, startCamera, stopStream]);

  if (!isOpen) return null;

  const handleClose = () => {
    stopStream();
    setCapturedDataUrl(null);
    onClose();
  };

  const handleCaptureFrame = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    stopStream();
    setCapturedDataUrl(dataUrl);
  };

  const buildFileFromDataUrl = async (dataUrl: string): Promise<File> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return new File([blob], `rx-camera-${stamp}.jpg`, { type: 'image/jpeg' });
  };

  const handleConfirm = async (keepCapturing: boolean) => {
    if (!capturedDataUrl || isSaving) return;
    setIsSaving(true);
    try {
      const file = await buildFileFromDataUrl(capturedDataUrl);
      await onCaptureFile(file);
      setCapturedDataUrl(null);
      if (!keepCapturing) {
        handleClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleNativeFallback = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsSaving(true);
    try {
      await onCaptureFile(file);
      handleClose();
    } finally {
      setIsSaving(false);
      e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        className="relative z-10 w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={copy.prescription.camera.modalTitle}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-blue-700" aria-hidden="true" />
            <h3 className="text-sm font-bold text-slate-800">
              {copy.prescription.camera.modalTitle}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 cursor-pointer"
            aria-label={copy.prescription.camera.closeBtn}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Camera / Captured Viewfinder */}
        <div className="bg-slate-950 relative aspect-[4/3] w-full flex items-center justify-center overflow-hidden">
          {capturedDataUrl ? (
            <img
              src={capturedDataUrl}
              alt={copy.prescription.camera.modalTitle}
              className="w-full h-full object-contain bg-slate-950"
            />
          ) : cameraError ? (
            <div className="p-6 text-center space-y-3 max-w-sm">
              <div className="w-10 h-10 rounded-xl bg-slate-800 text-blue-300 flex items-center justify-center mx-auto">
                <Camera className="w-5 h-5" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-white">
                {copy.prescription.camera.cameraUnavailableTitle}
              </p>
              <p className="text-xs text-slate-300 leading-relaxed">
                {copy.prescription.camera.cameraUnavailableDesc}
              </p>
              <input
                ref={nativeInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleNativeFallback}
                className="hidden"
              />
              <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => nativeInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{copy.prescription.camera.nativeCaptureBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void startCamera(facingMode)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{copy.prescription.refreshBtn}</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-cover"
              />

              {/* Subtle Prescription Framing Overlay */}
              <div
                className="pointer-events-none absolute inset-6 sm:inset-8 border border-white/40 rounded-xl"
                aria-hidden="true"
              >
                <span className="absolute -top-0.5 -start-0.5 w-5 h-5 border-t-2 border-s-2 border-blue-400 rounded-tl-md" />
                <span className="absolute -top-0.5 -end-0.5 w-5 h-5 border-t-2 border-e-2 border-blue-400 rounded-tr-md" />
                <span className="absolute -bottom-0.5 -start-0.5 w-5 h-5 border-b-2 border-s-2 border-blue-400 rounded-bl-md" />
                <span className="absolute -bottom-0.5 -end-0.5 w-5 h-5 border-b-2 border-e-2 border-blue-400 rounded-br-md" />
              </div>

              {isStarting && (
                <div className="absolute inset-0 bg-slate-950/75 flex items-center justify-center text-xs text-slate-200">
                  {copy.prescription.camera.startingCamera}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Controls */}
        <div className="p-4 bg-white border-t border-slate-100 space-y-3">
          {!capturedDataUrl && !cameraError && (
            <p className="text-[11px] text-slate-500 text-center">
              {copy.prescription.camera.guideHint}
            </p>
          )}

          {capturedDataUrl ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setCapturedDataUrl(null)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{copy.prescription.camera.retakeBtn}</span>
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleConfirm(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{copy.prescription.camera.addAnotherBtn}</span>
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleConfirm(false)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[38px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{copy.prescription.camera.usePhotoBtn}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={cameraError || isStarting}
                onClick={() =>
                  setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-700 text-xs font-medium cursor-pointer"
              >
                <SwitchCamera className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{copy.prescription.camera.switchCameraBtn}</span>
              </button>

              <button
                type="button"
                disabled={cameraError || isStarting}
                onClick={handleCaptureFrame}
                className="inline-flex items-center gap-2 px-5 py-2 min-h-[40px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold cursor-pointer shadow-xs"
              >
                <Camera className="w-4 h-4" aria-hidden="true" />
                <span>{copy.prescription.camera.captureBtn}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
