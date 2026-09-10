import z from 'zod';
import { parse } from 'partial-json';
import { repairJson } from '@toolsycc/json-repair';

export function sanitizeJsonString(raw: string): string {
  if (!raw) return '';

  let cleaned = raw.trim();

  // 1. Strip any reasoning-model thinking tags (<think>...</think>)
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 2. Extract content from markdown code blocks ```json ... ``` or ``` ... ```
  const codeBlockMatch = cleaned.match(/```(?:\w+)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    cleaned = codeBlockMatch[1].trim();
  } else {
    cleaned = cleaned.replace(/^```(?:\w+)?\s*/i, '').trim();
    cleaned = cleaned.replace(/```\s*$/i, '').trim();
  }

  // 3. Strip a leading "json" or "JSON" prefix (e.g. 'json {"query": ...}')
  cleaned = cleaned.replace(/^(?:json|JSON)\s*[:=]?\s*/, '').trim();

  // 4. Find the start of the first object/array ({ or [)
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let startIndex = -1;

  if (firstBrace !== -1 && firstBracket !== -1) {
    startIndex = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    startIndex = firstBrace;
  } else if (firstBracket !== -1) {
    startIndex = firstBracket;
  }

  if (startIndex !== -1) {
    cleaned = cleaned.substring(startIndex);
  }

  // 5. Strip any trailing text after the last closing bracket ({ or [)
  const lastBrace = cleaned.lastIndexOf('}');
  const lastBracket = cleaned.lastIndexOf(']');
  const endIndex = Math.max(lastBrace, lastBracket);
  if (endIndex !== -1 && endIndex < cleaned.length - 1) {
    cleaned = cleaned.substring(0, endIndex + 1);
  }

  // 6. Fix duplicated braces at the start (e.g. {{\n... or {\n{\n...)
  while (/^\{\s*\{/.test(cleaned)) {
    cleaned = cleaned.replace(/^\{\s*\{/, '{').trim();
  }
  while (/^\[\s*\[/.test(cleaned)) {
    cleaned = cleaned.replace(/^\[\s*\[/, '[').trim();
  }

  // 7. Strip excess closing braces at the end
  const openBraces = (cleaned.match(/\{/g) || []).length;
  const closeBraces = (cleaned.match(/\}/g) || []).length;
  if (closeBraces > openBraces) {
    let diff = closeBraces - openBraces;
    while (diff > 0 && /\}\s*$/.test(cleaned)) {
      cleaned = cleaned.replace(/\}\s*$/, '').trim();
      diff--;
    }
  }

  return cleaned.trim();
}

function tryValidateSchema<T>(
  obj: any,
  schema: z.ZodTypeAny,
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(obj);
  if (result.success) {
    return { success: true, data: result.data as T };
  }

  // Fallback: if the model wrapped the result in a parent field (e.g. response, data, result, output)
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const key of Object.keys(obj)) {
      const subVal = obj[key];
      if (subVal && typeof subVal === 'object') {
        const subResult = schema.safeParse(subVal);
        if (subResult.success) {
          return { success: true, data: subResult.data as T };
        }
      }
    }
  }

  return { success: false, error: result.error };
}

export function parseAndValidateObject<T>(
  rawContent: string,
  schema: z.ZodTypeAny,
  providerName: string = 'LLM',
): T {
  const isDebug =
    process.env.DEBUG === 'true' ||
    process.env.DEBUG_LLM === 'true' ||
    process.env.DEBUG_PARSER === 'true';

  if (!rawContent || !rawContent.trim()) {
    const emptyMsg = `Failed to parse JSON response from ${providerName}: Empty response received`;
    console.error(`[${providerName} JSON Parse Error] ${emptyMsg}`);
    throw new Error(emptyMsg);
  }

  const cleaned = sanitizeJsonString(rawContent);

  let lastZodError: z.ZodError | null = null;
  let lastJsonError: Error | null = null;

  // Strategy 1: Standard JSON.parse on the cleaned text
  try {
    const parsed = JSON.parse(cleaned);
    const valResult = tryValidateSchema<T>(parsed, schema);
    if (valResult.success) return valResult.data;
    lastZodError = valResult.error;
  } catch (err: any) {
    lastJsonError = err;
  }

  // Strategy 2: repairJson on the cleaned text
  try {
    const repaired = repairJson(cleaned, { extractJson: true });
    const parsed =
      typeof repaired === 'string' ? JSON.parse(repaired) : repaired;
    const valResult = tryValidateSchema<T>(parsed, schema);
    if (valResult.success) return valResult.data;
    lastZodError = valResult.error;
  } catch (err: any) {
    if (!lastJsonError) lastJsonError = err;
  }

  // Strategy 3: partial-json (for truncated / unclosed LLM responses)
  try {
    const partialParsed = parse(cleaned);
    if (partialParsed && typeof partialParsed === 'object') {
      const valResult = tryValidateSchema<T>(partialParsed, schema);
      if (valResult.success) return valResult.data;
      lastZodError = valResult.error;
    }
  } catch (err: any) {
    // ignore
  }

  // Strategy 4: repairJson directly on the raw text
  try {
    const repaired = repairJson(rawContent, { extractJson: true });
    const parsed =
      typeof repaired === 'string' ? JSON.parse(repaired) : repaired;
    const valResult = tryValidateSchema<T>(parsed, schema);
    if (valResult.success) return valResult.data;
    lastZodError = valResult.error;
  } catch (err: any) {
    // ignore
  }

  // Strategy 5: partial-json on the raw text
  try {
    const partialParsed = parse(rawContent);
    if (partialParsed && typeof partialParsed === 'object') {
      const valResult = tryValidateSchema<T>(partialParsed, schema);
      if (valResult.success) return valResult.data;
      lastZodError = valResult.error;
    }
  } catch (err: any) {
    // ignore
  }

  const snippet = (cleaned || rawContent).substring(0, 300);
  const detailedErrorMsg = lastZodError
    ? `Schema validation failed: ${lastZodError.issues.map((i: any) => `${i.path.join('.') || 'root'}: ${i.message}`).join('; ')}`
    : lastJsonError?.message || 'Invalid JSON format';

  console.error(
    `[${providerName} JSON Parse Error] ${detailedErrorMsg}\nMalformed snippet: "${snippet}"`,
  );

  if (isDebug) {
    console.error(`[${providerName} Full Raw Response]:\n`, rawContent);
  }

  throw new Error(
    `Failed to parse JSON response from ${providerName}: ${detailedErrorMsg}. Malformed snippet: "${snippet}"`,
  );
}
