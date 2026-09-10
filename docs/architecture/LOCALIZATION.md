# Internationalization and Localization Architecture (i18n)

This document describes the architecture, implementation, and rules for extending multi-language support in the **Vane-Community** application.

---

## 1. Overview and Principles

The internationalization system allows the UI language to be changed dynamically, in real time, from **Settings -> Preferences**. Changing the language requires no page reload and is propagated immediately to every React component in the application.

### Supported languages (the 12 most widely spoken worldwide and in Europe):
1. **Polish (pl)** - `Polski`
2. **English (en)** - the default language (`English`)
3. **Spanish (es)** - `Español`
4. **German (de)** - `Deutsch`
5. **French (fr)** - `Français`
6. **Italian (it)** - `Italiano`
7. **Portuguese (pt)** - `Português`
8. **Russian (ru)** - `Русский`
9. **Ukrainian (uk)** - `Українська`
10. **Simplified Chinese (zh)** - `简体中文`
11. **Japanese (ja)** - `日本語`
12. **Korean (ko)** - `한국어`

---

## 2. Directory and File Structure

All i18n resources live under `src/lib/i18n/`:

```
src/lib/i18n/
├── index.tsx           # Context, I18nProvider, useTranslation hook, translation engine
├── types.ts            # TypeScript types (Locale, LocaleInfo, the Translations interface)
└── locales/            # Language dictionaries
    ├── en.ts           # Reference / base language
    ├── pl.ts           # Polish
    ├── es.ts           # Spanish
    ├── de.ts           # German
    ├── fr.ts           # French
    ├── it.ts           # Italian
    ├── pt.ts           # Portuguese
    ├── ru.ts           # Russian
    ├── uk.ts           # Ukrainian
    ├── zh.ts           # Chinese (Simplified)
    ├── ja.ts           # Japanese
    └── ko.ts           # Korean
```

---

## 3. Key Mechanisms

### 3.1. Reactivity and Synchronization with Client State
- The language is stored in `localStorage` under the `language` key (`scope: 'client'`).
- Changing the option in the Settings dialog fires a `client-config-changed` system event.
- `I18nProvider` listens for `client-config-changed` and `storage` events, immediately updating the `locale` state and distributing the new dictionary throughout the React tree.

### 3.2. Parameter Interpolation and the Fallback Mechanism
- The translation function `t(key, params)` supports variable interpolation using the `{variableName}` pattern (e.g. `t('chat.researchProgress', { count: 3, steps: 'steps' })`).
- If a given key doesn't exist in the selected language, the engine automatically falls back to the English (`en`) version, and as a last resort returns the raw key path.

### 3.3. Type Safety
- The `Translations` interface in `types.ts` enforces full structural consistency across every file in `locales/`. Adding a new key without filling it in across every dictionary produces a TypeScript compilation error.

---

## 4. Usage Examples in Components

### Basic usage:
```tsx
import { useTranslation } from '@/lib/i18n';

export const MyComponent = () => {
  const { t, locale, setLocale } = useTranslation();

  return (
    <div>
      <h1>{t('chat.researchBeginsHere')}</h1>
      <p>{t('chat.askAnything')}</p>
    </div>
  );
};
```

### Usage with parameter interpolation:
```tsx
<span>
  {t('chat.researchProgress', {
    count: block.data.subSteps.length,
    steps: block.data.subSteps.length === 1 ? t('common.step') : t('common.steps'),
  })}
</span>
```

---

## 5. How to Add a New Language

1. Update the `Locale` type in `src/lib/i18n/types.ts`.
2. Add an entry to the `SUPPORTED_LOCALES` array in `src/lib/i18n/types.ts`.
3. Create a dictionary file, `src/lib/i18n/locales/<language_code>.ts`, implementing the `Translations` interface.
4. Import and register the dictionary in the `dictionaries` map in `src/lib/i18n/index.tsx`.
5. Add the option to the `Language` configuration field in `src/lib/config/index.ts`.

---

## 6. Navigation and the "New Query" / "Home" Action
- The `navigation.newQuery` key has been implemented for all 12 languages (`pl`: 'Nowe zapytanie', `en`: 'New query', `de`: 'Neue Anfrage', `es`: 'Nueva consulta', `fr`: 'Nouvelle requête', `it`: 'Nuova query', `ja`: '新しいクエリ', `zh`: '新查询', `ru`: 'Новый запрос', `uk`: 'Новий запит', `pt`: 'Nova consulta', `ko`: '새 질문').
- The `resetChat()` function in `useChat` safely aborts any response generation in progress, clears the message list, generates a new unique chat id, and switches the view to the welcome screen (`EmptyChat`) at the `/` path.
- The Logo button, "New query", and the "Home" icon in the sidebar and in the mobile top/bottom bars all call `resetChat()`, guaranteeing an immediate transition to a clean search state from any active thread.
