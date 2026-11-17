import React, { useState } from 'react';
import { FileUp, MessageCircle, Send, X } from 'lucide-react';
import { t } from '../data/translations';
import { Language } from '../types/pharmacy';

interface WhatsAppWidgetProps {
  lang: Language;
  onOpenPrescription: () => void;
}

export const WhatsAppWidget: React.FC<WhatsAppWidgetProps> = ({ lang, onOpenPrescription }) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const copy = t(lang);

  const launchWhatsApp = (customText?: string) => {
    const defaultMsg =
      lang === 'ar'
        ? 'مرحباً صيدلية محمد عبد ربه، أحتاج مساعدة صيدلاني.'
        : 'Hello Mohamed Abd Raboo Pharmacy, I would like pharmacist assistance.';
    const text = encodeURIComponent(customText?.trim() || defaultMsg);
    const url = `https://wa.me/201149737685?text=${text}`;
    window.location.assign(url);
  };

  return (
    <div className="fixed bottom-20 end-4 sm:end-5 z-40 flex flex-col items-end gap-3">
      {open && (
        <div className="w-80 max-w-[calc(100vw-2.5rem)] bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
          <div className="bg-blue-700 text-white px-4 py-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-xs sm:text-sm font-bold">{copy.whatsapp.title}</h3>
              <p className="text-[11px] text-blue-100 mt-0.5">{copy.whatsapp.subtitle}</p>
              <p className="text-[11px] text-blue-200 font-mono-tabular mt-0.5" dir="ltr">
                01149737685
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg text-blue-100 hover:text-white hover:bg-blue-600 cursor-pointer"
              aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3.5 space-y-2.5">
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() =>
                  launchWhatsApp(
                    lang === 'ar'
                      ? 'مرحباً، أريد استشارة صيدلانية حول دواء.'
                      : 'Hello, I need a quick pharmacist consultation.'
                  )
                }
                className="w-full text-start px-3 py-2 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 text-xs font-semibold text-slate-800 transition-colors cursor-pointer"
              >
                {copy.whatsapp.askPharmacist}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpenPrescription();
                }}
                className="w-full text-start px-3 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-xs font-semibold text-sky-900 inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <FileUp className="w-3.5 h-3.5 text-sky-700" aria-hidden="true" />
                <span>{copy.whatsapp.sendRx}</span>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                launchWhatsApp(message);
              }}
              className="flex items-center gap-2 pt-1"
            >
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={copy.whatsapp.messagePlaceholder}
                className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600"
              />
              <button
                type="submit"
                className="w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shrink-0 cursor-pointer"
                aria-label={copy.whatsapp.openWhatsapp}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="h-10 px-3.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md inline-flex items-center gap-1.5 text-xs font-semibold transition-transform hover:-translate-y-0.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        aria-label={copy.whatsapp.buttonLabel}
        aria-expanded={open}
      >
        <MessageCircle className="w-4 h-4" aria-hidden="true" />
        <span className="hidden sm:inline">{copy.whatsapp.buttonLabel}</span>
      </button>
    </div>
  );
};
