'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import {
  FileText,
  X,
  Plus,
  Sparkles,
  Cpu,
  BookOpen,
  Users,
  Check,
  Trash2,
  Edit2,
  Layers,
  Scale,
  Lightbulb,
  TrendingUp,
  History,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { toast } from 'sonner';
import { getLocalizedBuiltinTemplate } from '@/lib/scratchpad/builtinTemplates';

export interface ScratchpadTemplate {
  id: string;
  name: string;
  description?: string | null;
  icon?: string;
  content: string;
  systemInstructions?: string | null;
  isBuiltin: boolean;
  isOwner?: boolean;
}

const iconMap: Record<string, any> = {
  FileText,
  Sparkles,
  Cpu,
  BookOpen,
  Users,
  Scale,
  Lightbulb,
  TrendingUp,
  History,
};

interface ScratchpadTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate?: (template: ScratchpadTemplate | null) => void;
  saveCurrentNoteMode?: boolean;
  currentNoteContent?: string;
  currentNoteTitle?: string;
  onSavedAsTemplate?: () => void;
}

const ScratchpadTemplateDialog: React.FC<ScratchpadTemplateDialogProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
  saveCurrentNoteMode = false,
  currentNoteContent = '',
  currentNoteTitle = '',
  onSavedAsTemplate,
}) => {
  const { t, locale } = useTranslation();
  const [templates, setTemplates] = useState<ScratchpadTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Form states for creating/editing custom template
  const [isCreatingNew, setIsCreatingNew] = useState(saveCurrentNoteMode);
  const [name, setName] = useState(currentNoteTitle || '');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState(currentNoteContent || '');
  const [systemInstructions, setSystemInstructions] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('FileText');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (saveCurrentNoteMode) {
      setIsCreatingNew(true);
      setName(currentNoteTitle ? `Template: ${currentNoteTitle}` : '');
      setContent(currentNoteContent || '');
    } else {
      setIsCreatingNew(false);
    }
  }, [saveCurrentNoteMode, currentNoteContent, currentNoteTitle, isOpen]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/scratchpad/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(Array.isArray(data.templates) ? data.templates : []);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);

  const getLocalizedTemplateName = (tpl: ScratchpadTemplate) => {
    if (tpl.isBuiltin) {
      const builtin = getLocalizedBuiltinTemplate(tpl.id, locale);
      if (builtin?.name) return builtin.name;
    }
    if (tpl.id === 'tpl-research') return t('scratchpad.tplResearchName') || tpl.name;
    if (tpl.id === 'tpl-tech-comparison') return t('scratchpad.tplComparisonName') || tpl.name;
    if (tpl.id === 'tpl-concept-explainer') return t('scratchpad.tplExplainerName') || tpl.name;
    if (tpl.id === 'tpl-market-analysis') return t('scratchpad.tplMarketName') || tpl.name;
    if (tpl.id === 'tpl-biography-history') return t('scratchpad.tplBiographyName') || tpl.name;
    if (tpl.id === 'tpl-tech-how-it-works') return t('scratchpad.tplHowItWorksName') || tpl.name;
    if (tpl.id === 'tpl-literature-review') return t('scratchpad.tplLiteratureName') || tpl.name;
    return tpl.name;
  };

  const getLocalizedTemplateDesc = (tpl: ScratchpadTemplate) => {
    if (tpl.isBuiltin) {
      const builtin = getLocalizedBuiltinTemplate(tpl.id, locale);
      if (builtin?.description) return builtin.description;
    }
    if (tpl.id === 'tpl-research') return t('scratchpad.tplResearchDesc') || tpl.description;
    if (tpl.id === 'tpl-tech-comparison') return t('scratchpad.tplComparisonDesc') || tpl.description;
    if (tpl.id === 'tpl-concept-explainer') return t('scratchpad.tplExplainerDesc') || tpl.description;
    if (tpl.id === 'tpl-market-analysis') return t('scratchpad.tplMarketDesc') || tpl.description;
    if (tpl.id === 'tpl-biography-history') return t('scratchpad.tplBiographyDesc') || tpl.description;
    if (tpl.id === 'tpl-tech-how-it-works') return t('scratchpad.tplHowItWorksDesc') || tpl.description;
    if (tpl.id === 'tpl-literature-review') return t('scratchpad.tplLiteratureDesc') || tpl.description;
    return tpl.description;
  };

  const getLocalizedTemplateContent = (tpl: ScratchpadTemplate) => {
    if (tpl.isBuiltin) {
      const builtin = getLocalizedBuiltinTemplate(tpl.id, locale);
      if (builtin?.content) return builtin.content;
    }
    return tpl.content;
  };

  const getLocalizedTemplateInstructions = (tpl: ScratchpadTemplate) => {
    if (tpl.isBuiltin) {
      const builtin = getLocalizedBuiltinTemplate(tpl.id, locale);
      if (builtin?.systemInstructions) return builtin.systemInstructions;
    }
    return tpl.systemInstructions;
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !content.trim()) {
      toast.error(t('scratchpad.templateRequiredFields') || 'Name and skeleton content are required.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/scratchpad/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          icon: selectedIcon,
          content: content.trim(),
          systemInstructions: systemInstructions.trim() || null,
        }),
      });

      if (res.ok) {
        toast.success(t('scratchpad.templateSavedSuccess') || 'Template saved successfully.');
        fetchTemplates();
        setIsCreatingNew(false);
        onSavedAsTemplate?.();
        if (saveCurrentNoteMode) {
          onClose();
        }
      } else {
        const data = await res.json();
        toast.error(data.message || t('scratchpad.templateSaveError') || 'Failed to save template.');
      }
    } catch (err: any) {
      toast.error(err?.message || t('scratchpad.templateSaveError') || 'Network error while saving template.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const res = await fetch(`/api/scratchpad/templates/${templateId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success(t('scratchpad.templateDeletedSuccess') || 'Template deleted successfully.');
        fetchTemplates();
      } else {
        toast.error(t('scratchpad.templateDeleteError') || 'Failed to delete template.');
      }
    } catch {
      toast.error(t('scratchpad.templateDeleteError') || 'Connection error.');
    }
  };

  const activeTemplate = templates.find((tpl) => tpl.id === selectedId);

  return (
    <Transition show={isOpen} as={React.Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
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

        <div className="fixed inset-0 z-10 overflow-y-auto p-4 sm:p-6 md:p-10 flex items-center justify-center">
          <TransitionChild
            as={React.Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="relative transform overflow-hidden rounded-2xl bg-light-primary dark:bg-[#120f0d] border border-light-200 dark:border-[#2a241d] text-left shadow-2xl transition-all w-full max-w-4xl max-h-[85vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-light-200 dark:border-[#221c16] bg-light-secondary/50 dark:bg-[#181411]/50">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-xl bg-[#b8864d]/10 text-[#b8864d]">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <DialogTitle as="h3" className="text-base font-semibold text-stone-900 dark:text-stone-100">
                      {isCreatingNew
                        ? t('scratchpad.saveAsTemplate') || 'Save as template'
                        : t('scratchpad.chooseTemplate') || 'Choose starting template'}
                    </DialogTitle>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      {isCreatingNew
                        ? t('scratchpad.createTemplateSubtitle') || 'Define a reusable template with skeleton content and AI prompt instructions'
                        : t('scratchpad.chooseTemplateSubtitle') || 'Choose a ready note structure or start from a blank sketch'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {!saveCurrentNoteMode && (
                    <button
                      type="button"
                      onClick={() => setIsCreatingNew(!isCreatingNew)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-light-200 dark:border-[#2a241d] text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5 transition"
                    >
                      {isCreatingNew ? (
                        <span>{t('scratchpad.chooseTemplate') || 'Choose template'}</span>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5 text-[#b8864d]" />
                          <span>{t('scratchpad.createTemplate') || 'New template'}</span>
                        </>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6">
                {isCreatingNew ? (
                  /* Create / Save Form */
                  <form onSubmit={handleSaveTemplate} className="space-y-4 max-w-2xl mx-auto">
                    <div>
                      <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                        {t('scratchpad.templateName') || 'Template name'} *
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t('scratchpad.templateNamePlaceholder') || 'e.g., Company Equity Analysis'}
                        className="w-full px-3.5 py-2 rounded-xl border border-light-200 dark:border-[#2a241d] bg-light-secondary dark:bg-[#1a1613] text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:border-[#b8864d]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                        {t('scratchpad.templateDesc') || 'Template description'}
                      </label>
                      <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={t('scratchpad.templateDescPlaceholder') || 'Short summary explaining template purpose'}
                        className="w-full px-3.5 py-2 rounded-xl border border-light-200 dark:border-[#2a241d] bg-light-secondary dark:bg-[#1a1613] text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:border-[#b8864d]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                        {t('scratchpad.templateContent') || 'Skeleton content (Markdown)'} *
                      </label>
                      <textarea
                        required
                        rows={8}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder={t('scratchpad.templateSkeletonPlaceholder') || '# Title\n\n## 1. Introduction\n...'}
                        className="w-full font-mono text-xs px-3.5 py-2.5 rounded-xl border border-light-200 dark:border-[#2a241d] bg-light-secondary dark:bg-[#1a1613] text-stone-900 dark:text-stone-100 focus:outline-none focus:border-[#b8864d]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                        {t('scratchpad.templateInstructions') || 'Default AI instructions'}
                      </label>
                      <textarea
                        rows={3}
                        value={systemInstructions}
                        onChange={(e) => setSystemInstructions(e.target.value)}
                        placeholder={t('scratchpad.templateInstructionsPlaceholder') || 'Guidance for assistant when filling or editing this template'}
                        className="w-full text-xs px-3.5 py-2 rounded-xl border border-light-200 dark:border-[#2a241d] bg-light-secondary dark:bg-[#1a1613] text-stone-900 dark:text-stone-100 focus:outline-none focus:border-[#b8864d]"
                      />
                    </div>

                    <div className="flex items-center justify-end space-x-2 pt-2">
                      {!saveCurrentNoteMode && (
                        <button
                          type="button"
                          onClick={() => setIsCreatingNew(false)}
                          className="px-4 py-2 rounded-xl text-xs font-medium text-stone-500 hover:text-stone-700 transition"
                        >
                          {t('common.cancel') || 'Cancel'}
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-5 py-2 rounded-xl bg-[#b8864d] text-stone-950 text-xs font-semibold hover:brightness-110 active:scale-95 transition disabled:opacity-50"
                      >
                        {saving ? t('scratchpad.savingTemplateBtn') || t('common.loading') || 'Saving...' : t('scratchpad.saveTemplateBtn') || t('common.save') || 'Save template'}
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Template Selector Grid */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* Blank Option */}
                    <div
                      onClick={() => onSelectTemplate?.(null)}
                      className="group p-4 rounded-xl border border-dashed border-light-300 dark:border-[#332b22] hover:border-[#b8864d] dark:hover:border-[#b8864d] bg-light-secondary/40 dark:bg-[#16120f]/40 cursor-pointer transition flex items-start space-x-3"
                    >
                      <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 text-stone-600 dark:text-stone-400 group-hover:text-[#b8864d] transition shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100 group-hover:text-[#b8864d] transition">
                          {t('scratchpad.blankSketch') || 'Blank note'}
                        </h4>
                        <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                          {t('scratchpad.blankSketchDesc') || 'Start from a clean document and build a note from scratch with AI assistance.'}
                        </p>
                      </div>
                    </div>

                    {/* Template Cards */}
                    {templates.map((tpl) => {
                      const IconComp = iconMap[tpl.icon || 'FileText'] || FileText;
                      const localizedName = getLocalizedTemplateName(tpl);
                      const localizedDesc = getLocalizedTemplateDesc(tpl);
                      const localizedContent = getLocalizedTemplateContent(tpl);
                      const localizedInstructions = getLocalizedTemplateInstructions(tpl);

                      return (
                        <div
                          key={tpl.id}
                          onClick={() => onSelectTemplate?.({
                            ...tpl,
                            name: localizedName,
                            description: localizedDesc,
                            content: localizedContent,
                            systemInstructions: localizedInstructions,
                          })}
                          className="group p-4 rounded-xl border border-light-200 dark:border-[#26201a] hover:border-[#b8864d] dark:hover:border-[#b8864d] bg-light-secondary dark:bg-[#1a1613] cursor-pointer transition flex items-start justify-between space-x-3 shadow-sm hover:shadow-md"
                        >
                          <div className="flex items-start space-x-3">
                            <div className="p-2.5 rounded-xl bg-[#b8864d]/10 text-[#b8864d] shrink-0">
                              <IconComp className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100 group-hover:text-[#b8864d] transition">
                                  {localizedName}
                                </h4>
                                {tpl.isBuiltin && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-medium">
                                    {t('scratchpad.builtinBadge') || 'Built-in'}
                                  </span>
                                )}
                              </div>
                              {localizedDesc && (
                                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 line-clamp-2">
                                  {localizedDesc}
                                </p>
                              )}
                            </div>
                          </div>

                          {tpl.isOwner && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTemplate(tpl.id);
                              }}
                              title={t('scratchpad.deleteTemplate') || 'Delete this template'}
                              className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
};

export default ScratchpadTemplateDialog;
