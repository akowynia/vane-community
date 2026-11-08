export function cleanOllamaCloudBaseURL(url?: string): string {
  let cleaned = (url || 'https://ollama.com/v1').trim().replace(/\/+$/, '');
  // Strip endpoint paths if user pasted full endpoint (e.g. /v1/chat/completions)
  cleaned = cleaned.replace(/\/(chat\/completions|completions|embeddings|api\/tags|api\/chat)$/i, '');
  cleaned = cleaned.replace(/\/+$/, '');

  if (cleaned.endsWith('/v1')) {
    return cleaned;
  }
  if (cleaned.endsWith('/api')) {
    return cleaned.replace(/\/api$/i, '/v1');
  }
  return `${cleaned}/v1`;
}
