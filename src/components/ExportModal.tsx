import React, { useState } from 'react';
import { X, Download, FileSpreadsheet, FileText, CheckCircle2 } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const [selectedType, setSelectedType] = useState<string>('ALL_OPPORTUNITIES');
  const [format, setFormat] = useState<'csv' | 'xlsx'>('csv');

  if (!isOpen) return null;

  const exportOptions = [
    {
      id: 'ALL_OPPORTUNITIES',
      title: 'All Discovered Opportunities',
      desc: 'All active jobs, internships, and fresher openings across Bangalore startups.',
    },
    {
      id: 'INTERNSHIPS',
      title: 'Internships & Trainee Openings',
      desc: 'Filtered list of internships, apprenticeships, and summer analyst roles.',
    },
    {
      id: 'AI_ML_ROLES',
      title: 'AI / ML & GenAI Opportunities',
      desc: 'Roles with AI relevance score ≥ 60 (LLM, NLP, PyTorch, Computer Vision).',
    },
    {
      id: 'FRESHER_ROLES',
      title: 'Fresher & Entry-Level Roles',
      desc: 'Openings suitable for 0-2 years experience, graduates, and interns.',
    },
    {
      id: 'WITH_EMAILS',
      title: 'Opportunities with Public Emails',
      desc: 'Startup roles having verified recruitment/HR contact addresses.',
    },
    {
      id: 'VERIFIED_ONLY',
      title: 'Verified Opportunities Only',
      desc: 'Opportunities with confirmed official careers or ATS board sources.',
    },
    {
      id: 'ALL_COMPANIES',
      title: 'All Discovered Companies',
      desc: 'Master directory of Bangalore startups with official websites and status.',
    },
    {
      id: 'FAILED_COMPANIES',
      title: 'Failed Companies',
      desc: 'Companies that encountered network/scrape errors for debugging.',
    },
  ];

  const handleDownload = () => {
    const url = `/api/export/${format}?type=${selectedType}`;
    window.location.href = url;
    onClose();
  };

  return (
    <div
      id="export-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Export Intelligence Data</h2>
              <p className="text-xs text-gray-500 font-medium">
                Download structured data in CSV or Excel spreadsheet format
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Format Selector */}
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-2">
              Select Export Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  format === 'csv'
                    ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <FileText className={`w-5 h-5 ${format === 'csv' ? 'text-blue-600' : 'text-gray-400'}`} />
                <div>
                  <div className="text-xs font-bold text-gray-900">CSV Spreadsheet</div>
                  <div className="text-[11px] text-gray-500">Universal comma-separated format</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('xlsx')}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  format === 'xlsx'
                    ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600/20'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <FileSpreadsheet className={`w-5 h-5 ${format === 'xlsx' ? 'text-emerald-600' : 'text-gray-400'}`} />
                <div>
                  <div className="text-xs font-bold text-gray-900">Microsoft Excel (XLSX)</div>
                  <div className="text-[11px] text-gray-500">Formatted workbook file</div>
                </div>
              </button>
            </div>
          </div>

          {/* Dataset Option */}
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-2">
              Select Dataset Slice
            </label>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {exportOptions.map((opt) => {
                const isSelected = selectedType === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => setSelectedType(opt.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-gray-900">{opt.title}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{opt.desc}</div>
                    </div>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            id="btn-confirm-export"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" /> Download {format.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
};
