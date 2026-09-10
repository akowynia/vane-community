import { useTranslation } from '@/lib/i18n';

const Citation = ({
  href,
  title,
  children,
}: {
  href: string;
  title?: string;
  children: React.ReactNode;
}) => {
  const { t } = useTranslation();
  const isFile =
    !href ||
    href === 'File' ||
    href.startsWith('file_id://') ||
    !href.startsWith('http');

  const tooltipText = title
    ? isFile
      ? t('chat.citationFileLabel', { title }) || `File: ${title}`
      : `${title} (${href})`
    : isFile
      ? t('chat.citationAttachedFile') || 'Attached file'
      : href;

  if (isFile) {
    return (
      <span
        title={tooltipText}
        className="bg-light-secondary dark:bg-dark-secondary px-1 rounded ml-1 text-xs text-black/70 dark:text-white/70 relative cursor-default inline-block select-none"
      >
        {children}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={tooltipText}
      className="bg-light-secondary hover:bg-light-200 dark:bg-dark-secondary dark:hover:bg-dark-200 px-1 rounded ml-1 no-underline text-xs text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white relative transition-colors duration-150 inline-block"
    >
      {children}
    </a>
  );
};

export default Citation;
