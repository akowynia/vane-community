'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import {
  Download,
  FileText,
  FileCode,
  FileSpreadsheet,
  Printer,
  Archive,
  BookOpen,
  Calendar,
  Layers,
  Palette,
  Loader2,
  X,
  Check,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { toast } from 'sonner';
import {
  BulkExportItem,
  ExportFormat,
  executeBulkExport,
  fetchFullChatsForExport,
  fetchFullScratchpadsForExport,
} from '@/lib/export/bulkExportHelper';
import { PdfExportStyle } from '@/lib/utils/printExport';
import { getPdfExportStyle } from '@/lib/config/clientRegistry';

export interface BulkExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  selectedCount: number;
  itemType: 'chats' | 'notes' | 'batch' | 'crons' | 'waypoints';
  // Static items already available in memory (e.g. scratchpad, batch, crons, waypoints)
  items?: BulkExportItem[];
  // If IDs are provided instead (e.g. chats that require asynchronous fetching of full history)
  selectedIds?: string[];
}

export const BulkExportDialog: React.FC<BulkExportDialogProps> = ({
  isOpen,
  onClose,
  title,
  selectedCount,
  itemType,
  items,
  selectedIds = [],
}) => {
  const { t, locale } = useTranslation();

  const [format, setFormat] = useState<ExportFormat>('docx');
  const [includeSources, setIncludeSources] = useState<boolean>(true);
  const [includeMetadata, setIncludeMetadata] = useState<boolean>(true);
  const [separateFiles, setSeparateFiles] = useState<boolean>(false);
  const [pdfStyle, setPdfStyle] = useState<PdfExportStyle>(getPdfExportStyle());
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progressStatus, setProgressStatus] = useState<string>('');

  const count = selectedCount || items?.length || selectedIds.length || 0;

  const handleExport = async () => {
    if (count === 0) return;

    setIsExporting(true);
    setProgressStatus(t('bulkExport.preparingData') || 'Preparing export data...');

    try {
      let exportItems: BulkExportItem[] = [];

      if (items && items.length > 0) {
        exportItems = items;
      } else if (itemType === 'chats' && selectedIds.length > 0) {
        setProgressStatus(
          t('bulkExport.fetchingChats', { count: selectedIds.length }) ||
            `Fetching ${selectedIds.length} conversations...`,
        );
        exportItems = await fetchFullChatsForExport(selectedIds);
      } else if (itemType === 'notes' && selectedIds.length > 0) {
        setProgressStatus(
          t('bulkExport.fetchingNotes', { count: selectedIds.length }) ||
            `Fetching ${selectedIds.length} notes...`,
        );
        exportItems = await fetchFullScratchpadsForExport(selectedIds);
      }

      if (exportItems.length === 0) {
        toast.error(t('bulkExport.noDataToExport') || 'No data found to export.');
        setIsExporting(false);
        return;
      }

      setProgressStatus(
        t('bulkExport.generatingFile', { format: format.toUpperCase() }) ||
          `Generating ${format.toUpperCase()} file...`,
      );

      const defaultDocTitle =
        title ||
        `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} Export (${exportItems.length})`;

      const success = await executeBulkExport({
        documentTitle: defaultDocTitle,
        items: exportItems,
        format,
        includeSources,
        includeMetadata,
        separateFiles: format !== 'pdf' && separateFiles,
        pdfStyle,
        locale,
      });

      if (success) {
        toast.success(
          t('bulkExport.exportSuccess', { count: exportItems.length }) ||
            `Successfully exported ${exportItems.length} items!`,
        );
        onClose();
      } else {
        toast.error(t('bulkExport.exportError') || 'Failed to complete export.');
      }
    } catch (err: any) {
      console.error('Bulk export failure:', err);
      toast.error(err?.message || t('bulkExport.exportError') || 'An error occurred during export.');
    } finally {
      setIsExporting(false);
      setProgressStatus('');
    }
  };

  const formatOptions: Array<{
    id: ExportFormat;
    name: string;
    extension: string;
    icon: React.ElementType;
    desc: string;
  }> = [
    {
      id: 'docx',
      name: 'Microsoft Word',
      extension: '.docx',
      icon: FileSpreadsheet,
      desc: t('bulkExport.docxDesc') || 'Native OpenXML Word document with formatted styles and headings',
    },
    {
      id: 'pdf',
      name: 'Print / PDF',
      extension: '.pdf',
      icon: Printer,
      desc: t('bulkExport.pdfDesc') || 'High-fidelity document for printing or saving as PDF',
    },
    {
      id: 'md',
      name: 'Markdown',
      extension: '.md',
      icon: FileCode,
      desc: t('bulkExport.mdDesc') || 'Clean markdown format for documentation and notes',
    },
    {
      id: 'html',
      name: 'HTML Report',
      extension: '.html',
      icon: FileText,
      desc: t('bulkExport.htmlDesc') || 'Standalone styled web page report viewable anywhere',
    },
    {
      id: 'txt',
      name: 'Plain Text',
      extension: '.txt',
      icon: FileText,
      desc: t('bulkExport.txtDesc') || 'Unformatted plain text document with clean typography',
    },
    {
      id: 'json',
      name: 'JSON Data',
      extension: '.json',
      icon: Layers,
      desc: t('bulkExport.jsonDesc') || 'Raw structured data format for backup and programmatic import',
    },
  ];

  return (
    <Transition show={isOpen} as={React.Fragment}>
      <Dialog as="div" className="relative z-50" onClose={isExporting ? () => {} : onClose}>
        <TransitionChild
          as={React.Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <DialogBackdrop className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" />
        </TransitionChild>

        <div className="fixed inset-0 z-10 overflow-y-auto p-4 flex items-center justify-center">
          <TransitionChild
            as={React.Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="relative transform overflow-hidden rounded-2xl bg-light-primary dark:bg-[#120f0d] border border-light-200 dark:border-[#2a241d] text-left shadow-2xl transition-all w-full max-w-lg p-6">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-light-200 dark:border-[#221c16]">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-xl bg-[#b8864d]/15 text-[#b8864d]">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <DialogTitle as="h3" className="text-base font-semibold text-stone-900 dark:text-stone-100">
                      {t('bulkExport.dialogTitle') || 'Export Selected Items'}
                    </DialogTitle>
                    <p className="text-xs text-stone-500">
                      {t('bulkExport.itemsSelectedCount', { count }) || `${count} items selected for export`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={onClose}
                  className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg transition disabled:opacity-50 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Format Selection Grid */}
              <div className="mt-4 space-y-2">
                <label className="text-xs font-semibold text-stone-800 dark:text-stone-200 block">
                  {t('bulkExport.selectFormat') || 'Select Export Format'}
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {formatOptions.map((opt) => {
                    const isSelected = format === opt.id;
                    const IconComponent = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={isExporting}
                        onClick={() => setFormat(opt.id)}
                        className={`flex flex-col items-start p-3 rounded-xl border text-left transition cursor-pointer ${
                          isSelected
                            ? 'border-[#b8864d] bg-[#b8864d]/10 dark:bg-[#b8864d]/15 shadow-sm'
                            : 'border-light-200 dark:border-[#251f19] bg-light-secondary/40 dark:bg-[#181411]/50 hover:border-[#b8864d]/50'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1.5">
                          <IconComponent
                            className={`w-4 h-4 ${
                              isSelected ? 'text-[#b8864d]' : 'text-stone-500'
                            }`}
                          />
                          <span className="text-[10px] font-mono uppercase text-stone-400">
                            {opt.extension}
                          </span>
                        </div>
                        <span
                          className={`text-xs font-semibold ${
                            isSelected
                              ? 'text-[#b8864d]'
                              : 'text-stone-800 dark:text-stone-200'
                          }`}
                        >
                          {opt.name}
                        </span>
                        <span className="text-[10px] text-stone-500 dark:text-stone-400 line-clamp-1 mt-0.5">
                          {opt.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Export Options */}
              <div className="mt-4 space-y-2.5 pt-3 border-t border-light-200 dark:border-[#221c16]">
                <label className="text-xs font-semibold text-stone-800 dark:text-stone-200 block">
                  {t('bulkExport.optionsHeading') || 'Export Options'}
                </label>

                {/* Sources & References Toggle */}
                <label className="flex items-center justify-between p-2.5 rounded-xl border border-light-200 dark:border-[#251f19] bg-light-secondary/30 dark:bg-[#16120e]/60 cursor-pointer hover:border-[#b8864d]/40 transition">
                  <div className="flex items-center space-x-2.5">
                    <BookOpen className="w-4 h-4 text-[#b8864d] shrink-0" />
                    <div>
                      <span className="text-xs font-medium text-stone-800 dark:text-stone-200 block">
                        {t('bulkExport.includeSources') || 'Include sources and citations'}
                      </span>
                      <span className="text-[11px] text-stone-500 block">
                        {t('bulkExport.includeSourcesDesc') || 'Append bibliography and web links to exported records'}
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeSources}
                    onChange={(e) => setIncludeSources(e.target.checked)}
                    disabled={isExporting}
                    className="w-4 h-4 accent-[#b8864d] rounded cursor-pointer"
                  />
                </label>

                {/* Metadata & Timestamps Toggle */}
                <label className="flex items-center justify-between p-2.5 rounded-xl border border-light-200 dark:border-[#251f19] bg-light-secondary/30 dark:bg-[#16120e]/60 cursor-pointer hover:border-[#b8864d]/40 transition">
                  <div className="flex items-center space-x-2.5">
                    <Calendar className="w-4 h-4 text-[#b8864d] shrink-0" />
                    <div>
                      <span className="text-xs font-medium text-stone-800 dark:text-stone-200 block">
                        {t('bulkExport.includeMetadata') || 'Include timestamps and metadata'}
                      </span>
                      <span className="text-[11px] text-stone-500 block">
                        {t('bulkExport.includeMetadataDesc') || 'Preserve creation dates, model names, and query counters'}
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeMetadata}
                    onChange={(e) => setIncludeMetadata(e.target.checked)}
                    disabled={isExporting}
                    className="w-4 h-4 accent-[#b8864d] rounded cursor-pointer"
                  />
                </label>

                {/* File Packaging: Consolidated vs ZIP (if count > 1 and not PDF) */}
                {count > 1 && format !== 'pdf' && (
                  <label className="flex items-center justify-between p-2.5 rounded-xl border border-light-200 dark:border-[#251f19] bg-light-secondary/30 dark:bg-[#16120e]/60 cursor-pointer hover:border-[#b8864d]/40 transition">
                    <div className="flex items-center space-x-2.5">
                      <Archive className="w-4 h-4 text-[#b8864d] shrink-0" />
                      <div>
                        <span className="text-xs font-medium text-stone-800 dark:text-stone-200 block">
                          {t('bulkExport.packageAsZip') || 'Package as ZIP archive'}
                        </span>
                        <span className="text-[11px] text-stone-500 block">
                          {separateFiles
                            ? t('bulkExport.zipDescIndividual') || 'Each item will be saved as an individual file in a ZIP'
                            : t('bulkExport.zipDescConsolidated') || 'Export as a single combined document'}
                        </span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={separateFiles}
                      onChange={(e) => setSeparateFiles(e.target.checked)}
                      disabled={isExporting}
                      className="w-4 h-4 accent-[#b8864d] rounded cursor-pointer"
                    />
                  </label>
                )}

                {/* PDF Style Selector (if format is PDF or HTML) */}
                {(format === 'pdf' || format === 'html') && (
                  <div className="p-2.5 rounded-xl border border-light-200 dark:border-[#251f19] bg-light-secondary/30 dark:bg-[#16120e]/60 space-y-1.5">
                    <div className="flex items-center space-x-2 text-xs font-medium text-stone-800 dark:text-stone-200">
                      <Palette className="w-4 h-4 text-[#b8864d]" />
                      <span>{t('bulkExport.pdfStyleLabel') || 'Visual Document Style'}</span>
                    </div>
                    <select
                      value={pdfStyle}
                      onChange={(e) => setPdfStyle(e.target.value as PdfExportStyle)}
                      disabled={isExporting}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-light-primary dark:bg-[#1a1511] border border-light-300 dark:border-[#382b20] text-xs font-medium text-stone-800 dark:text-stone-200 focus:outline-none focus:border-[#b8864d]"
                    >
                      <option value="vane">Vane Classic (Signature Warm Bronze)</option>
                      <option value="minimal">Minimal Neutral (Clean White-label)</option>
                      <option value="corporate">Corporate Executive (Navy / Slate)</option>
                      <option value="academic">Academic Paper (Serif Monograph)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Progress Indicator */}
              {isExporting && (
                <div className="mt-4 p-3 rounded-xl border border-[#b8864d]/30 bg-[#b8864d]/10 flex items-center space-x-2.5 text-xs text-[#b8864d] font-medium">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>{progressStatus || t('bulkExport.exporting') || 'Exporting items...'}</span>
                </div>
              )}

              {/* Actions Footer */}
              <div className="mt-6 flex items-center justify-end space-x-2.5 pt-4 border-t border-light-200 dark:border-[#221c16]">
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-light-200 dark:border-[#2e261e] text-xs font-medium text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-light-200/50 dark:hover:bg-[#201a14] transition cursor-pointer disabled:opacity-50"
                >
                  {t('bulkDelete.exitSelectMode') || 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={isExporting || count === 0}
                  onClick={handleExport}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#b8864d] hover:bg-[#a6743b] text-white text-xs font-semibold transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t('bulkExport.exporting') || 'Exporting...'}</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>
                        {t('bulkExport.exportCount', { count }) || `Export (${count})`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
};

export default BulkExportDialog;
