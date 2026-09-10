export interface BuiltinTemplateDefinition {
  id: string;
  name: Record<string, string>;
  description: Record<string, string>;
  icon: string;
  content: Record<string, string>;
  systemInstructions: Record<string, string>;
}

export const BUILTIN_TEMPLATES: BuiltinTemplateDefinition[] = [
  // 1. Research & Topic Analysis
  {
    id: 'tpl-research',
    icon: 'Sparkles',
    name: {
      pl: 'Badania i Analiza Tematu',
      en: 'Research & Topic Analysis',
      de: 'Recherche & Themenanalyse',
      es: 'Investigación y Análisis',
      fr: 'Recherche et Analyse Thématique',
      it: 'Ricerca e Analisi Tematica',
      ja: 'リサーチとテーマ分析',
      ko: '주제 조사 및 분석',
      pt: 'Pesquisa e Análise Temática',
      ru: 'Исследование и Анализ Темы',
      uk: 'Дослідження та Аналіз Теми',
      zh: '课题研究与分析',
    },
    description: {
      pl: 'Strukturyzowane opracowanie zagadnienia z podziałem na tezy, dowody, analizę i źródła.',
      en: 'Structured topic breakdown with hypotheses, evidence, analysis, and sources.',
      de: 'Strukturierte Aufbereitung mit Hypothesen, Nachweisen, Analyse und Quellen.',
      es: 'Estructuración metódica con hipótesis, evidencia, análisis y fuentes.',
      fr: 'Structure méthodique avec hypothèses, preuves, analyse et sources.',
      it: 'Sviluppo strutturato con tesi, prove, analisi approfondita e fonti.',
      ja: '仮説、根拠、分析、情報源を含む論理的な構成テンプレート。',
      ko: '가설, 근거, 심층 분석 및 출처를 포함한 체계적인 연구 보고서.',
      pt: 'Estrutura detalhada com teses, evidências, análise e fontes.',
      ru: 'Структурированный разбор с тезисами, аргументами, аналитикой и источниками.',
      uk: 'Структурований розбір із тезами, доказами, аналітикою та джерелами.',
      zh: '结构化论述，涵盖论点、证据、深入分析与可靠来源。',
    },
    content: {
      pl: `# Badania i Analiza: [Temat]

## 1. Wprowadzenie i Kontekst
Wprowadzenie do zagadnienia oraz cel opracowania.

## 2. Kluczowe Tezy i Ustalenia
- **Główny wniosek 1**: Opis i znaczenie
- **Główny wniosek 2**: Opis i znaczenie

## 3. Szczegółowa Analiza Merytoryczna
Dogłębne rozwinięcie tematu wraz z danymi i faktami.

## 4. Wnioski i Rekomendacje
Podsumowanie najważniejszych wniosków oraz potencjalne kierunki dalszych badań.
`,
      en: `# Research & Analysis: [Topic]

## 1. Introduction & Context
Background of the topic and objectives of the analysis.

## 2. Key Findings & Theses
- **Key Finding 1**: Description and significance
- **Key Finding 2**: Description and significance

## 3. In-Depth Analysis
Comprehensive exploration of the subject backed by facts and data.

## 4. Conclusions & Recommendations
Summary of main takeaways and potential directions for future research.
`,
      de: `# Recherche & Analyse: [Thema]

## 1. Einleitung & Kontext
Hintergrund des Themas und Zielsetzung der Analyse.

## 2. Kernaussagen & Erkenntnisse
- **Kernergebnis 1**: Beschreibung und Bedeutung
- **Kernergebnis 2**: Beschreibung und Bedeutung

## 3. Detaillierte Analyse
Umfassende Untersuchung des Themas mit Fakten und Belegen.

## 4. Fazit & Handlungsempfehlungen
Zusammenfassung der wichtigsten Ergebnisse und Ausblick.
`,
      es: `# Investigación y Análisis: [Tema]

## 1. Introducción y Contexto
Contexto del tema y objetivos del análisis.

## 2. Hallazgos Clave y Tesis
- **Conclusión principal 1**: Descripción e impacto
- **Conclusión principal 2**: Descripción e impacto

## 3. Análisis Detallado
Desarrollo profundo del tema respaldado por hechos y datos.

## 4. Conclusiones y Recomendaciones
Resumen de los puntos clave y posibles líneas de investigación.
`,
      fr: `# Recherche et Analyse : [Sujet]

## 1. Introduction et Contexte
Présentation du sujet et objectifs de l'analyse.

## 2. Thèses et Constats Clés
- **Constat clé 1** : Description et portée
- **Constat clé 2** : Description et portée

## 3. Analyse Approfondie
Développement thématique détaillé avec données et faits.

## 4. Conclusions et Recommandations
Synthèse des principaux enseignements et pistes de recherche.
`,
      it: `# Ricerca e Analisi: [Argomento]

## 1. Introduzione e Contesto
Inquadramento del tema e obiettivi dell'analisi.

## 2. Tesi e Risultati Chiave
- **Risultato principale 1**: Descrizione e rilevanza
- **Risultato principale 2**: Descrizione e rilevanza

## 3. Analisi Dettagliata
Approfondimento tematico con dati, prove e riferimenti.

## 4. Conclusioni e Raccomandazioni
Sintesi dei punti focali e prospettive future di approfondimento.
`,
      ja: `# リサーチとテーマ分析: [テーマ]

## 1. 導入と背景
テーマの概要と分析の目的。

## 2. 主な仮説と発見事項
- **重要な発見 1**: 詳細と重要性
- **重要な発見 2**: 詳細と重要性

## 3. 詳細な分析
データと事実に基づく多角的な考察。

## 4. 結論と提言
主要な結論のまとめと今後の展望。
`,
      ko: `# 주제 조사 및 심층 분석: [주제]

## 1. 도입 및 배경
주제에 대한 기본 개요 및 분석 목적.

## 2. 핵심 가설 및 주요 발견
- **핵심 결과 1**: 설명 및 시사점
- **핵심 결과 2**: 설명 및 시사점

## 3. 상세 분석
데이터와 실증적 근거에 기반한 심층 분석.

## 4. 결론 및 제언
주요 요약 및 향후 권장 연구 방향.
`,
      pt: `# Pesquisa e Análise: [Tema]

## 1. Introdução e Contexto
Apresentação do tema e objetivos da análise.

## 2. Principais Teses e Descobertas
- **Achado principal 1**: Descrição e relevância
- **Achado principal 2**: Descrição e relevância

## 3. Análise Aprofundada
Desenvolvimento do assunto sustentado por dados e evidências.

## 4. Conclusões e Recomendações
Síntese das conclusões e direcionamentos futuros.
`,
      ru: `# Исследование и Анализ: [Тема]

## 1. Введение и Контекст
Обзор проблематики и цели исследования.

## 2. Ключевые Тезисы и Выводы
- **Главный вывод 1**: Описание и практическая ценность
- **Главный вывод 2**: Описание и практическая ценность

## 3. Подробный Анализ
Глубокая проработка темы с фактами и аргументами.

## 4. Заключение и Рекомендации
Синтез результатов и вектор дальнейшего изучения.
`,
      uk: `# Дослідження та Аналіз: [Тема]

## 1. Вступ і Контекст
Огляд проблематики та мета дослідження.

## 2. Ключові Тези та Висновки
- **Головний висновок 1**: Опис і практичне значення
- **Головний висновок 2**: Опис і практичне значення

## 3. Детальний Аналіз
Глибоке опрацювання теми з фактами й доказами.

## 4. Підсумки та Рекомендації
Синтез результатів і напрямки подальшого аналізу.
`,
      zh: `# 课题研究与分析: [主题]

## 1. 背景与概述
研究背景、核心问题与分析目标。

## 2. 核心论点与关键发现
- **关键发现 1**: 具体阐述与重要意义
- **关键发现 2**: 具体阐述与重要意义

## 3. 深入论述与事实分析
结合翔实数据与事实进行严密论证。

## 4. 结论与建议
总结核心要点并提出未来研究或实施建议。
`,
    },
    systemInstructions: {
      pl: 'Twórz notatkę badawczą w sposób precyzyjny, analityczny i poparty faktami. Zawsze weryfikuj źródła i umieszczaj odnośniki w treści.',
      en: 'Write a research note with rigorous factual grounding, precise analytical depth, and clear source citations.',
      de: 'Erstelle eine präzise, analytische Forschungsnotiz mit geprüften Fakten und nachvollziehbaren Quellen.',
      es: 'Redacta una nota de investigación precisa, analítica y respaldada por hechos con citas de fuentes claras.',
      fr: 'Rédigez une note de recherche analytique, rigoureuse et factuelle, appuyée par des sources vérifiées.',
      it: 'Redigi una nota di ricerca precisa, analitica e verificata con citazioni puntuali delle fonti.',
      ja: '事実に基づいた正確で論理的な分析ノートを作成し、信頼できる情報源を引用してください。',
      ko: '검증된 사실과 출처를 바탕으로 엄밀하고 체계적인 연구 분석 노트를 작성하세요.',
      pt: 'Redija uma nota de pesquisa analítica, precisa e sustentada por fatos com citações claras.',
      ru: 'Создавайте аналитическую исследовательскую заметку с опорой на факты и точные ссылки на источники.',
      uk: 'Створюйте аналітичну дослідницьку нотатку з опорою на факти та точні посилання на джерела.',
      zh: '撰写严谨、客观、具备分析深度的研究笔记，务必标注可靠的事实依据与来源。',
    },
  },

  // 2. Technology / Tool Comparisons
  {
    id: 'tpl-tech-comparison',
    icon: 'Scale',
    name: {
      pl: 'Porównania technologii / narzędzi',
      en: 'Technology & Tool Comparison',
      de: 'Technologie- & Tool-Vergleich',
      es: 'Comparación de Tecnologías y Herramientas',
      fr: 'Comparatif de Technologies et Outils',
      it: 'Confronto Tecnologie e Strumenti',
      ja: '技術・ツールの比較',
      ko: '기술 및 도구 비교 분석',
      pt: 'Comparação de Tecnologias e Ferramentas',
      ru: 'Сравнение технологий и инструментов',
      uk: 'Порівняння технологій та інструментів',
      zh: '技术与工具深度对比',
    },
    description: {
      pl: 'Zestawienie porównawcze technologii lub narzędzi z tabelą kryteriów, zaletami, wadami i rekomendacjami wyboru.',
      en: 'Side-by-side comparison of tools/technologies with feature matrices, pros/cons, and decision trade-offs.',
      de: 'Detaillierter Vergleich von Technologien mit Bewertungsmatrix, Vor-/Nachteilen und Entscheidungshilfen.',
      es: 'Comparativa exhaustiva con tabla de criterios, pros y contras y guía de selección.',
      fr: 'Comparatif détaillé avec grille multicritères, avantages, inconvénients et guide de choix.',
      it: 'Confronto approfondito con matrice di valutazione, vantaggi, svantaggi e guida alla scelta.',
      ja: '機能比較表、メリット・デメリット、選定基準を含む詳細な技術比較。',
      ko: '기능 비교 매트릭스, 장단점 및 상황별 선정 기준을 담은 기술 비교 분석.',
      pt: 'Comparativo estruturado com tabela de critérios, pontos fortes, fracos e recomendações.',
      ru: 'Сравнительный анализ решений с матрицей критериев, плюсами, минусами и критериями выбора.',
      uk: 'Порівняльний аналіз рішень із матрицею критеріїв, плюсами, мінусами та рекомендаціями щодо вибору.',
      zh: '涵盖多维度对比矩阵、优缺点分析及场景选型建议的深度技术对比。',
    },
    content: {
      pl: `# Porównanie: [Technologia A] vs [Technologia B]

## 1. Podsumowanie Wykonawcze (TL;DR)
Krótka synteza różnic i ostateczna rekomendacja wyboru w typowych scenariuszach.

## 2. Tabela Porównawcza Cech
| Kryterium / Cecha | [Technologia A] | [Technologia B] |
| :--- | :--- | :--- |
| **Główny paradygmat / Model** | ... | ... |
| **Wydajność i zasobożerność** | ... | ... |
| **Krzywa uczenia się (DX)** | ... | ... |
| **Ekosystem i społeczność** | ... | ... |
| **Licencja i koszty** | ... | ... |

## 3. Szczegółowa Analiza: [Technologia A]
- **Mocne strony (Zalety)**:
  - Zaleta 1: opis
  - Zaleta 2: opis
- **Ograniczenia i słabe punkty**:
  - Wada 1: opis

## 4. Szczegółowa Analiza: [Technologia B]
- **Mocne strony (Zalety)**:
  - Zaleta 1: opis
  - Zaleta 2: opis
- **Ograniczenia i słabe punkty**:
  - Wada 1: opis

## 5. Rekomendacje Decyzyjne (Kiedy wybrać co?)
- **Wybierz [Technologia A], gdy**:
  - Warunek 1
  - Warunek 2
- **Wybierz [Technologia B], gdy**:
  - Warunek 1
  - Warunek 2
`,
      en: `# Comparison: [Technology A] vs [Technology B]

## 1. Executive Summary (TL;DR)
Concise synthesis of key differences and high-level decision guidance for typical scenarios.

## 2. Feature & Criteria Matrix
| Criterion / Feature | [Technology A] | [Technology B] |
| :--- | :--- | :--- |
| **Core Paradigm / Architecture** | ... | ... |
| **Performance & Resource Footprint** | ... | ... |
| **Developer Experience & Learning Curve** | ... | ... |
| **Ecosystem & Community Maturity** | ... | ... |
| **Licensing & TCO (Costs)** | ... | ... |

## 3. In-Depth Analysis: [Technology A]
- **Key Strengths (Pros)**:
  - Pro 1: details
  - Pro 2: details
- **Limitations & Trade-offs (Cons)**:
  - Con 1: details

## 4. In-Depth Analysis: [Technology B]
- **Key Strengths (Pros)**:
  - Pro 1: details
  - Pro 2: details
- **Limitations & Trade-offs (Cons)**:
  - Con 1: details

## 5. Decision Framework (When to Choose Which)
- **Choose [Technology A] if**:
  - Use case 1
  - Use case 2
- **Choose [Technology B] if**:
  - Use case 1
  - Use case 2
`,
      de: `# Vergleich: [Technologie A] vs. [Technologie B]

## 1. Zusammenfassung (TL;DR)
Kompakte Gegenüberstellung und klare Entscheidungsempfehlung.

## 2. Kriterien- und Funktionsmatrix
| Kriterium / Eigenschaft | [Technologie A] | [Technologie B] |
| :--- | :--- | :--- |
| **Architektur / Paradigma** | ... | ... |
| **Performance & Ressourcen** | ... | ... |
| **Lernkurve & Developer Experience** | ... | ... |
| **Ökosystem & Community** | ... | ... |
| **Lizenzierung & Kosten** | ... | ... |

## 3. Detailanalyse: [Technologie A]
- **Vorteile (Pros)**:
  - Vorteil 1
- **Nachteile & Grenzen (Cons)**:
  - Nachteil 1

## 4. Detailanalyse: [Technologie B]
- **Vorteile (Pros)**:
  - Vorteil 1
- **Nachteile & Grenzen (Cons)**:
  - Nachteil 1

## 5. Entscheidungshilfe (Wann welches Tool?)
- **Wähle [Technologie A], wenn**:
  - Szenario 1
- **Wähle [Technologie B], wenn**:
  - Szenario 1
`,
      es: `# Comparativa: [Tecnología A] vs [Tecnología B]

## 1. Resumen Ejecutivo (TL;DR)
Síntesis de diferencias clave y recomendación para escenarios habituales.

## 2. Tabla Comparativa de Criterios
| Criterio / Característica | [Tecnología A] | [Tecnología B] |
| :--- | :--- | :--- |
| **Arquitectura / Paradigma** | ... | ... |
| **Rendimiento y Recursos** | ... | ... |
| **Experiencia de Desarrollo (DX)** | ... | ... |
| **Ecosistema y Comunidad** | ... | ... |
| **Licenciamiento y Costes** | ... | ... |

## 3. Análisis Detallado: [Tecnología A]
- **Puntos Fuertes (Pros)**:
  - Ventaja 1
- **Limitaciones (Contras)**:
  - Desventaja 1

## 4. Análisis Detallado: [Tecnología B]
- **Puntos Fuertes (Pros)**:
  - Ventaja 1
- **Limitaciones (Contras)**:
  - Desventaja 1

## 5. Guía de Selección
- **Elige [Tecnología A] cuando**:
  - Caso 1
- **Elige [Tecnología B] cuando**:
  - Caso 1
`,
      fr: `# Comparatif : [Technologie A] vs [Technologie B]

## 1. Résumé Exécutif (TL;DR)
Synthèse des différences majeures et orientation décisionnelle.

## 2. Grille Comparative des Critères
| Critère / Fonctionnalité | [Technologie A] | [Technologie B] |
| :--- | :--- | :--- |
| **Paradigme / Architecture** | ... | ... |
| **Performance et Ressources** | ... | ... |
| **Expérience Développeur (DX)** | ... | ... |
| **Écosystème et Communauté** | ... | ... |
| **Licence et Coûts** | ... | ... |

## 3. Analyse Approfondie : [Technologie A]
- **Points Forts (Avantages)**:
  - Atout 1
- **Limites et Compromis (Inconvénients)**:
  - Limite 1

## 4. Analyse Approfondie : [Technologie B]
- **Points Forts (Avantages)**:
  - Atout 1
- **Limites et Compromis (Inconvénients)**:
  - Limite 1

## 5. Recommandations de Choix
- **Optez pour [Technologie A] si**:
  - Cas 1
- **Optez pour [Technologie B] si**:
  - Cas 1
`,
      it: `# Confronto: [Tecnologia A] vs [Tecnologia B]

## 1. Sintesi Esecutiva (TL;DR)
Quadro sintetico delle differenze e indicazioni di scelta.

## 2. Matrice di Valutazione Comparativa
| Criterio / Funzionalità | [Tecnologia A] | [Tecnologia B] |
| :--- | :--- | :--- |
| **Architettura e Paradigma** | ... | ... |
| **Prestazioni e Consumo Risorse** | ... | ... |
| **Curva di Apprendimento (DX)** | ... | ... |
| **Ecosistema e Supporto** | ... | ... |
| **Licenza e Costi** | ... | ... |

## 3. Analisi Dettagliata: [Tecnologia A]
- **Punti di Forza**:
  - Vantaggio 1
- **Limitazioni e Criticità**:
  - Svantaggio 1

## 4. Analisi Dettagliata: [Tecnologia B]
- **Punti di Forza**:
  - Vantaggio 1
- **Limitazioni e Criticità**:
  - Svantaggio 1

## 5. Guida alla Decisione
- **Scegli [Tecnologia A] quando**:
  - Scenario 1
- **Scegli [Tecnologia B] quando**:
  - Scenario 1
`,
      ja: `# 比較検証: [テクノロジー A] vs [テクノロジー B]

## 1. エグゼクティブサマリー (TL;DR)
主な相違点と一般的な選定指針の要約。

## 2. 機能・評価基準の比較表
| 評価基準 / 項目 | [テクノロジー A] | [テクノロジー B] |
| :--- | :--- | :--- |
| **基本アーキテクチャ** | ... | ... |
| **パフォーマンスとリソース** | ... | ... |
| **開発者体験 (DX) と学習コスト** | ... | ... |
| **エコシステムとコミュニティ** | ... | ... |
| **ライセンスと導入コスト** | ... | ... |

## 3. 詳細分析: [テクノロジー A]
- **長所・メリット**:
  - メリット 1
- **短所・制約事項**:
  - デメリット 1

## 4. 詳細分析: [テクノロジー B]
- **長所・メリット**:
  - メリット 1
- **短所・制約事項**:
  - デメリット 1

## 5. 選定ガイドライン（どちらを選ぶべきか）
- **[テクノロジー A] を選ぶべきケース**:
  - 条件 1
- **[テクノロジー B] を選ぶべきケース**:
  - 条件 1
`,
      ko: `# 기술 비교 분석: [기술 A] vs [기술 B]

## 1. 요약 (TL;DR)
핵심 차이점 요약 및 상황별 최종 권장안.

## 2. 세부 기준 비교 매트릭스
| 평가 기준 / 기능 | [기술 A] | [기술 B] |
| :--- | :--- | :--- |
| **핵심 패러다임 / 아키텍처** | ... | ... |
| **성능 및 리소스 사용량** | ... | ... |
| **학습 곡선 및 개발자 경험 (DX)** | ... | ... |
| **생태계 및 커뮤니티 활성도** | ... | ... |
| **라이선스 및 도입 비용** | ... | ... |

## 3. 상세 분석: [기술 A]
- **주요 장점 (Pros)**:
  - 장점 1
- **한계점 및 단점 (Cons)**:
  - 단점 1

## 4. 상세 분석: [기술 B]
- **주요 장점 (Pros)**:
  - 장점 1
- **한계점 및 단점 (Cons)**:
  - 단점 1

## 5. 의사결정 가이드
- **[기술 A] 선택 권장 상황**:
  - 케이스 1
- **[기술 B] 선택 권장 상황**:
  - 케이스 1
`,
      pt: `# Comparativo: [Tecnologia A] vs [Tecnologia B]

## 1. Resumo Executivo (TL;DR)
Síntese das diferenças fundamentais e orientação de escolha.

## 2. Matriz Comparativa de Critérios
| Critério / Recurso | [Tecnologia A] | [Tecnologia B] |
| :--- | :--- | :--- |
| **Arquitetura / Paradigma** | ... | ... |
| **Desempenho e Recursos** | ... | ... |
| **Experiência do Desenvolvedor (DX)** | ... | ... |
| **Ecossistema e Comunidade** | ... | ... |
| **Licença e Custos** | ... | ... |

## 3. Análise Detalhada: [Tecnologia A]
- **Pontos Fortes (Prós)**:
  - Vantagem 1
- **Limitações (Contras)**:
  - Desvantagem 1

## 4. Análise Detalhada: [Tecnologia B]
- **Pontos Fortes (Prós)**:
  - Vantagem 1
- **Limitações (Contras)**:
  - Desvantagem 1

## 5. Recomendações de Decisão
- **Escolha [Tecnologia A] quando**:
  - Cenário 1
- **Escolha [Tecnologia B] quando**:
  - Cenário 1
`,
      ru: `# Сравнение: [Технология A] vs [Технология B]

## 1. Краткое Резюме (TL;DR)
Главные отличия и ключевой вывод по выбору решения.

## 2. Сравнительная Таблица Критериев
| Критерий / Параметр | [Технология A] | [Технология B] |
| :--- | :--- | :--- |
| **Архитектура / Парадигма** | ... | ... |
| **Производительность и ресурсы** | ... | ... |
| **Порог входа и DX** | ... | ... |
| **Экосистема и сообщество** | ... | ... |
| **Лицензия и стоимость** | ... | ... |

## 3. Детальный Разбор: [Технология A]
- **Сильные стороны (Плюсы)**:
  - Плюс 1
- **Ограничения и недостатки (Минусы)**:
  - Минус 1

## 4. Детальный Разбор: [Технология B]
- **Сильные стороны (Плюсы)**:
  - Плюс 1
- **Ограничения и недостатки (Минусы)**:
  - Минус 1

## 5. Рекомендации по Выбору
- **Выбирайте [Технология A], если**:
  - Сценарий 1
- **Выбирайте [Технология B], если**:
  - Сценарий 1
`,
      uk: `# Порівняння: [Технологія A] vs [Технологія B]

## 1. Коротке Резюме (TL;DR)
Головні відмінності та ключовий висновок щодо вибору рішення.

## 2. Порівняльна Таблиця Критеріїв
| Критерій / Параметр | [Технологія A] | [Технологія B] |
| :--- | :--- | :--- |
| **Архітектура / Парадигма** | ... | ... |
| **Продуктивність і ресурси** | ... | ... |
| **Поріг входження та DX** | ... | ... |
| **Екосистема та спільнота** | ... | ... |
| **Ліцензія та вартість** | ... | ... |

## 3. Детальний Розбір: [Технологія A]
- **Сильні сторони (Плюси)**:
  - Плюс 1
- **Обмеження та недоліки (Мінуси)**:
  - Мінус 1

## 4. Детальний Розбір: [Технологія B]
- **Сильні сторони (Плюси)**:
  - Плюс 1
- **Обмеження та недоліки (Мінуси)**:
  - Мінус 1

## 5. Рекомендації щодо Вибору
- **Обирайте [Технологія A], якщо**:
  - Сценарій 1
- **Обирайте [Технологія B], якщо**:
  - Сценарій 1
`,
      zh: `# 方案对比: [技术方案 A] vs [技术方案 B]

## 1. 核心结论摘要 (TL;DR)
简明扼要对比两者的本质差异与场景适用结论。

## 2. 关键指标对比矩阵
| 评估维度 / 指标 | [技术方案 A] | [技术方案 B] |
| :--- | :--- | :--- |
| **核心范式 / 架构模型** | ... | ... |
| **性能与资源开销** | ... | ... |
| **开发体验与上手门槛** | ... | ... |
| **生态成熟度与社区支持** | ... | ... |
| **开源许可与总体成本** | ... | ... |

## 3. 方案深入剖析: [技术方案 A]
- **核心优势 (Pros)**:
  - 优势 1
- **主要短板与局限 (Cons)**:
  - 劣势 1

## 4. 方案深入剖析: [技术方案 B]
- **核心优势 (Pros)**:
  - 优势 1
- **主要短板与局限 (Cons)**:
  - 劣势 1

## 5. 选型决策指南 (如何选型)
- **推荐选择 [技术方案 A] 的场景**:
  - 场景 1
- **推荐选择 [技术方案 B] 的场景**:
  - 场景 1
`,
    },
    systemInstructions: {
      pl: 'Twórz obiektywne, technicznie precyzyjne porównania. Zestawiaj kluczowe cechy w zwięzłej, czytelnej tabeli Markdown (krótkie hasła/metryki w komórkach, bez wielozdaniowych akapitów wewnątrz tabeli; szczegółowe opisy rozwijaj w dedykowanych sekcjach poniżej). Unikaj stronniczości i podawaj konkretne kompromisy (trade-offs).',
      en: 'Deliver objective, technically rigorous comparisons. Tabulate key metrics into a clean, concise Markdown table (use compact cell values and avoid long paragraphs inside cells; detail nuances in subsequent narrative sections). Highlight genuine trade-offs and actionable recommendations.',
      de: 'Erstelle objektive, technisch fundierte Vergleiche. Verwende kompakte, übersichtliche Markdown-Tabellen ohne lange Absätze in Zellen (Details in den nachfolgenden Abschnitten ausführen). Zeige echte Kompromisse und praxisnahe Entscheidungshilfen auf.',
      es: 'Crea comparativas objetivas y precisas. Diseña tablas Markdown concisas con celdas breves (sin párrafos largos dentro de las celdas; desarrolla los detalles en las secciones inferiores) y analiza los trade-offs reales.',
      fr: 'Produisez des comparatifs objectifs et rigoureux. Utilisez des tableaux Markdown synthétiques aux cellules concises (évitez les longs paragraphes dans les cellules ; détaillez dans les sections suivantes) et analysez les compromis réels.',
      it: 'Elabora confronti oggettivi e rigorosi. Utilizza tabelle Markdown sintetiche con celle concise (senza lunghi paragrafi nelle celle; approfondisci nelle sezioni successive) e analizza i trade-off reali.',
      ja: '客観的かつ技術的に厳密な比較を作成してください。Markdown表のセルは簡潔なキーワードや指標にとどめ（セル内に長文段落を入れず、詳細は後続の各セクションで解説）、具体的なトレードオフを提示してください。',
      ko: '객관적이고 기술적으로 정밀한 비교를 작성하세요. Markdown 표의 각 셀은 간결한 키워드와 지표로 작성하고(셀 내 장문 단락 지양, 상세 내용은 하위 섹션에서 서술), 실질적인 트레이드오프를 제시하세요.',
      pt: 'Produza comparações objetivas e precisas. Estruture tabelas Markdown concisas com células breves (sem parágrafos longos dentro das células; detalhe nas seções abaixo) e aponte trade-offs reais.',
      ru: 'Создавайте объективные и технически точные сравнения. Формируйте компактные таблицы Markdown с лаконичными ячейками (без длинных абзацев внутри ячеек; подробности раскрывайте в разделах ниже) и анализом компромиссов.',
      uk: 'Створюйте об’єктивні та технічно точні порівняння. Формуйте компактні таблиці Markdown із лаконічними комірками (без довгих абзаців усередині комірок; деталі розкривайте в розділах нижче) та аналізом компромісів.',
      zh: '提供客观、严谨的技术对比。构建紧凑清晰的 Markdown 矩阵表格（单元格内保持简明短语/指标，避免长篇段落；详细分析在下文展开），客观剖析架构取舍。',
    },
  },

  // 3. Technical / Scientific Concept Explanations
  {
    id: 'tpl-concept-explainer',
    icon: 'Lightbulb',
    name: {
      pl: 'Wyjaśnienia pojęć technicznych / naukowych',
      en: 'Technical & Scientific Concept Explainer',
      de: 'Erklärung technischer & wissenschaftlicher Begriffe',
      es: 'Explicación de Conceptos Técnicos y Científicos',
      fr: 'Explication de Concepts Techniques et Scientifiques',
      it: 'Spiegazione Concetti Tecnici e Scientifici',
      ja: '技術・科学概念の解説',
      ko: '기술 및 과학 개념 심층 해설',
      pt: 'Explicação de Conceitos Técnicos e Científicos',
      ru: 'Объяснение технических и научных концепций',
      uk: 'Пояснення технічних і наукових концепцій',
      zh: '前沿技术与科学概念深度解析',
    },
    description: {
      pl: 'Wielopoziomowe wyjaśnienie pojęcia od intuicyjnej analogii, przez definicję formalną, po przykłady i mity.',
      en: 'Layered conceptual explanation from intuitive metaphors (ELI5) to formal definitions, examples, and common misconceptions.',
      de: 'Mehrstufige Begriffserklärung von einfachen Analogien über formale Definitionen bis hin zu Beispielen und Mythen.',
      es: 'Explicación multinivel desde analogías intuitivas hasta definiciones rigurosas, ejemplos y mitos comunes.',
      fr: 'Explication progressive d’un concept : de la métaphore intuitive à la définition formelle, avec cas concrets et pièges à éviter.',
      it: 'Spiegazione a livelli di un concetto: dall’analogia intuitiva alla definizione formale, con esempi e miti sfatati.',
      ja: '直感的な例え話から厳密な定義、実践例、誤解の解消まで段階的に解説。',
      ko: '직관적인 비유(ELI5)부터 엄밀한 수식/정의, 실전 예시 및 흔한 오해까지 다단계로 해설.',
      pt: 'Explicação em camadas: da metáfora intuitiva à definição formal, com exemplos práticos e mitos.',
      ru: 'Многоуровневое объяснение понятий: от простых аналогий до строгих определений, примеров и мифов.',
      uk: 'Багаторівневе пояснення понять: від простих аналогій до строгих визначень, прикладів та міфів.',
      zh: '从通俗类比（ELI5）到严谨形式化定义、实战案例及常见认知误区的多层次概念解析。',
    },
    content: {
      pl: `# Pojęcie: [Nazwa Pojęcia / Zjawiska]

## 1. Intuicja w Prostych Słowach (ELI5 / Analogia)
Intuicyjne wytłumaczenie koncepcji za pomocą życiowej analogii, zrozumiałe bez wiedzy specjalistycznej.

## 2. Definicja Formalna i Mechanizm Działania
Precyzyjne sformułowanie definicji, zasady matematyczne/architektoniczne oraz kluczowe komponenty.

## 3. Przykłady Praktyczne i Zastosowania
Konkretne przykłady ze świata rzeczywistego, fragmenty kodu lub wzory pokazujące pojęcie w akcji.

## 4. Częste Błędy Poznawcze i Mity
- **Mit**: Błędne powszechne przekonanie.
  - *Fakty*: Dlaczego rzeczywistość wygląda inaczej.

## 5. Podsumowanie i Powiązane Zagadnienia
Syntetyczna puenta w 2–3 zdaniach oraz lista pojęć do dalszego zgłębienia.
`,
      en: `# Concept: [Concept / Phenomenon Name]

## 1. Intuition in Plain Words (ELI5 / Analogy)
Intuitive explanation using a relatable real-world analogy accessible to non-specialists.

## 2. Formal Definition & Mechanics
Rigorous technical/scientific definition, fundamental laws/rules, and key underlying mechanisms.

## 3. Practical Examples & Applications
Concrete real-world applications, diagrams/code snippets, or formulas showcasing the concept in action.

## 4. Common Misconceptions & Pitfalls
- **Misconception**: Frequent false assumption.
  - *Reality*: What actually happens and why.

## 5. Summary & Related Concepts
Concise 2–3 sentence takeaway and connected concepts for further exploration.
`,
      de: `# Begriff: [Name des Konzepts / Begriffs]

## 1. Intuition in einfachen Worten (ELI5 / Analogie)
Anschauliche Erklärung anhand einer alltagsnahen Analogie.

## 2. Formale Definition & Funktionsweise
Präzise Definition, wissenschaftliche/technische Gesetzmäßigkeiten und Kernmechanismen.

## 3. Praxisbeispiele & Anwendungsfelder
Konkrete Beispiele, Code-Auszüge oder Formeln in Aktion.

## 4. Häufige Missverständnisse & Mythen
- **Mythos**: Weit verbreitete Fehlannahme.
  - *Klarstellung*: Wie es sich tatsächlich verhält.

## 5. Fazit & Verwandte Themen
Kompakte Kernaussage und weiterführende Konzepte.
`,
      es: `# Concepto: [Nombre del Concepto / Fenómeno]

## 1. Intuición en Palabras Sencillas (ELI5 / Analogía)
Explicación comprensible mediante una analogía cotidiana.

## 2. Definición Formal y Principios de Funcionamiento
Definición rigurosa, fundamentos técnicos/científicos y mecanismos internos.

## 3. Ejemplos Prácticos y Aplicaciones
Casos de uso reales, fragmentos de código o ecuaciones demostrativas.

## 4. Mitos Comunes y Errores Habituales
- **Mito**: Creencia errónea común.
  - *Realidad*: Explicación fundada.

## 5. Resumen y Conceptos Relacionados
Puntos clave y siguientes conceptos a explorar.
`,
      fr: `# Concept : [Nom du Concept / Phénomène]

## 1. Intuition en Mots Simples (ELI5 / Métaphore)
Explication intuitive à travers une métaphore concrète.

## 2. Définition Formelle et Mécanisme
Formulation rigoureuse, principes sous-jacents et fonctionnement interne.

## 3. Exemples Pratiques et Applications
Illustrations concrètes, extraits de code ou formules démontrant l'application réelle.

## 4. Idées Reçues et Pièges Fréquents
- **Idée reçue**: Fausse supposition courante.
  - *Réalité*: Explication factuelle.

## 5. Synthèse et Concepts Connexes
Synthèse en quelques phrases et pistes d'approfondissement.
`,
      it: `# Concetto: [Nome del Concetto / Fenomeno]

## 1. Comprensione Intuitiva (ELI5 / Analogia)
Spiegazione semplice e visiva tramite un'analogia concreta.

## 2. Definizione Formale e Funzionamento
Definizione rigorosa, principi scientifico-tecnici e dinamiche interne.

## 3. Esempi Pratici e Ambiti Applicativi
Esempi reali, codice o formule che mostrano il concetto all'opera.

## 4. Falsi Miti ed Errori Comuni
- **Falso mito**: Errore diffuso.
  - *Realtà*: Come stanno effettivamente le cose.

## 5. Sintesi e Concetti Correlati
Conclusione sintetica e concetti affini da esplorare.
`,
      ja: `# 概念解説: [概念・用語・現象名]

## 1. 直感的な理解（例え話 / ELI5）
専門知識がなくても理解できる日常的な比喩を用いた解説。

## 2. 正式な定義と動作メカニズム
厳密な科学的・技術的定義、基礎理論、および内部の仕組み。

## 3. 具体例と応用事例
実際のユースケース、コードスニペット、または数式による実践的解説。

## 4. よくある誤解と注意点
- **誤解**: よくある思い込み。
  - *実際*: 正しい仕組みと理由。

## 5. まとめと関連概念
要約とさらに深く学ぶための関連トピック。
`,
      ko: `# 핵심 개념 해설: [개념 / 현상 명칭]

## 1. 직관적 이해 (비유 / ELI5)
전문 지식이 없어도 쉽게 이해할 수 있는 일상 속 비유를 통한 설명.

## 2. 공식 정의 및 작동 메커니즘
학술적/기술적으로 엄밀한 정의 및 세부 작동 원리.

## 3. 실제 사례 및 응용
현실 세계 적용 사례, 코드 예제 또는 수식 기반의 실증적 설명.

## 4. 흔한 오해 및 주의사항
- **흔한 오해**: 잘못 알려진 상식.
  - *진실*: 실제 작동 원리 및 사실 관계.

## 5. 핵심 요약 및 연관 개념
2~3문장 요약 및 추가로 학습할 연관 주제.
`,
      pt: `# Conceito: [Nome do Conceito / Fenômeno]

## 1. Intuição em Palavras Simples (ELI5 / Analogia)
Explicação intuitiva baseada em metáforas do dia a dia.

## 2. Definição Formal e Mecanismo de Funcionamento
Definição rigorosa, regras científicas/técnicas e dinâmica interna.

## 3. Exemplos Práticos e Aplicações
Aplicações no mundo real, código ou equações ilustrativas.

## 4. Mitos Comuns e Erros Frequentes
- **Mito**: Suposição incorreta frequente.
  - *Realidade*: Como realmente funciona.

## 5. Síntese e Conceitos Relacionados
Resumo conciso e tópicos correlatos para aprofundamento.
`,
      ru: `# Концепция: [Название понятия / феномена]

## 1. Простая Интуиция (Аналогия / ELI5)
Доходчивое объяснение на жизненном примере без сложного жаргона.

## 2. Строгое Определение и Механизм Работы
Точная научная/техническая формулировка и внутренние принципы.

## 3. Практические Примеры и Применение
Реальные сценарии, фрагменты кода или формулы в действии.

## 4. Распространенные Заблуждения и Мифы
- **Миф**: Частое ошибочное представление.
  - *Факты*: Как все устроено на самом деле.

## 5. Выводы и Связанные Темы
Краткая суть в 2–3 предложениях и темы для дальнейшего изучения.
`,
      uk: `# Концепція: [Назва поняття / явища]

## 1. Проста Інтуїція (Аналогія / ELI5)
Зрозуміле пояснення на життєвому прикладі без складного жаргону.

## 2. Строге Визначення та Механізм Роботи
Точне наукове/технічне формулювання та внутрішні принципи.

## 3. Практичні Приклади та Застосування
Реальні сценарії, фрагменти коду або формули в дії.

## 4. Поширені Помилки та Міфи
- **Міф**: Часте хибне уявлення.
  - *Факти*: Як усе влаштовано насправді.

## 5. Висновки та Пов’язані Теми
Коротка суть у 2–3 реченнях і теми для подальшого вивчення.
`,
      zh: `# 概念解析: [概念 / 专业术语名称]

## 1. 通俗直觉与形象类比 (ELI5)
运用贴近生活的生动比喻，无需专业背景也能迅速理解核心本质。

## 2. 形式化定义与底层机制
严谨的技术/科学定义、数学原理及系统运行机制。

## 3. 实际应用与典型示例
真实应用场景、代码示例或公式推导。

## 4. 常见误区与认知陷阱
- **常见误区**: 广泛存在的错误认知。
  - *事实剖析*: 真实情况与背后成因。

## 5. 核心总结与进阶拓展
2~3 句话凝练结论，并列出延伸关联概念。
`,
    },
    systemInstructions: {
      pl: 'Tłumacz trudne zagadnienia techniką Feynmana: od intuicyjnej analogii, przez definicję formalną, aż po przykłady i rozprawienie się z mitami.',
      en: 'Apply the Feynman Technique: start with accessible analogies, establish formal technical definitions, provide tangible examples, and dispel common myths.',
      de: 'Erkläre nach der Feynman-Methode: von einfachen Analogien über formale Strenge bis zu anschaulichen Beispielen und Richtigstellungen.',
      es: 'Aplica la Técnica Feynman: comienza con analogías comprensibles, define con rigor técnico, proporciona ejemplos reales y desmonta mitos.',
      fr: 'Appliquez la méthode Feynman : de l’analogie intuitive à la définition formelle et aux exemples pratiques, en clarifiant les idées reçues.',
      it: 'Usa la tecnica di Feynman: parti da analogie intuitive, procedi con definizioni formali, fornisci esempi pratici e sfata gli errori comuni.',
      ja: 'ファインマン・テクニックを活用し、直感的な比喩から厳密な定義、実例、誤解の解消へと段階的に分かりやすく説明してください。',
      ko: '파인만 기법을 적용하여 직관적인 비유에서 시작해 엄밀한 정의, 실사례, 오해 해소로 이어지는 명쾌한 해설을 제공하세요.',
      pt: 'Aplique a técnica de Feynman: parta de analogias intuitivas, avance para definições formais, traga exemplos reais e desfaça mitos.',
      ru: 'Используйте метод Фейнмана: от интуитивной аналогии к строгому определению, наглядным примерам и разоблачению мифов.',
      uk: 'Використовуйте метод Фейнмана: від інтуїтивної аналогії до строгого визначення, наочних прикладів та спростування міфів.',
      zh: '践行费曼学习法：从通俗类比切入，建立严谨定义，结合实战代码与案例，并击碎常见误区。',
    },
  },

  // 4. Market / Industry Analysis
  {
    id: 'tpl-market-analysis',
    icon: 'TrendingUp',
    name: {
      pl: 'Analiza rynkowa / branżowa',
      en: 'Market & Industry Analysis',
      de: 'Markt- & Branchenanalyse',
      es: 'Análisis de Mercado y Sector',
      fr: 'Analyse de Marché et Sectorielle',
      it: 'Analisi di Mercato e di Settore',
      ja: '市場・業界動向分析',
      ko: '시장 및 산업 동향 분석',
      pt: 'Análise de Mercado e Setorial',
      ru: 'Анализ рынка и отрасли',
      uk: 'Аналіз ринку та галузі',
      zh: '行业与市场深度分析',
    },
    description: {
      pl: 'Kompleksowe badanie rynku, trendów, dynamiki wzrostu, konkurencji i barier wejścia.',
      en: 'Comprehensive market breakdown covering market sizing (TAM/SAM), growth drivers, competitive landscape, and barriers to entry.',
      de: 'Umfassende Marktanalyse mit Marktgrößen, Wachstumstreibern, Wettbewerbslandschaft und Markteintrittsbarrieren.',
      es: 'Estudio de mercado integral: tamaño, drivers de crecimiento, mapa de competencia y barreras de entrada.',
      fr: 'Étude de marché complète : taille (TAM), facteurs de croissance, paysage concurrentiel et barrières à l’entrée.',
      it: 'Analisi di mercato esaustiva: dimensionamento, driver di crescita, mappa competitiva e barriere all’ingresso.',
      ja: '市場規模（TAM/SAM）、成長要因、競合マップ、参入障壁を網羅した包括的な業界調査。',
      ko: '시장 규모(TAM/SAM), 성장 동력, 경쟁 구도 및 진입 장벽을 다루는 종합 산업 분석.',
      pt: 'Estudo de mercado completo: dimensão, fatores de crescimento, concorrência e barreiras de entrada.',
      ru: 'Анализ рынка: объем (TAM/SAM), драйверы роста, конкурентная карта и барьеры входа.',
      uk: 'Аналіз ринку: обсяг (TAM/SAM), драйвери зростання, конкурентна карта та бар’єри входу.',
      zh: '涵盖市场规模测算（TAM/SAM）、增长驱动因素、竞争格局矩阵及行业壁垒的深度商业分析。',
    },
    content: {
      pl: `# Analiza Rynku: [Sektor / Branża / Nisza]

## 1. Wielkość Rynku i Dynamika Wzrostu
Szacunkowa wartość rynku (TAM/SAM/SOM), wskaźniki CAGR oraz obecna faza dojrzałości branży.

## 2. Kluczowe Trendy i Czynniki Wzrostu (Drivers)
- **Trend technologiczny**: Wpływ innowacji na sektor.
- **Trend rynkowy / konsumencki**: Zmiana potrzeb odbiorców.
- **Czynniki makro i regulacyjne**: Przepisy prawne i uwarunkowania gospodarcze.

## 3. Mapa Konkurencji i Główni Gracze
| Segment / Gracz | Pozycja na rynku | Kluczowe Przewagi | Słabe Punkty |
| :--- | :--- | :--- | :--- |
| **Lider rynku** | ... | ... | ... |
| **Innowacyjny challenger** | ... | ... | ... |

## 4. Szanse, Zagrożenia i Bariery Wejścia
- **Szanse rynkowe**: Niezagospodarowane nisze i potencjał ekspansji.
- **Ryzyka i zagrożenia**: Czynniki mogące wyhamować wzrost.
- **Bariery wejścia**: Kapitał, technologia, certyfikacje.

## 5. Prognoza i Wnioski Strategiczne
Kierunek ewolucji branży w horyzoncie 3–5 lat oraz strategiczne rekomendacje.
`,
      en: `# Market Analysis: [Sector / Industry / Niche]

## 1. Market Size & Growth Dynamics
Market valuation (TAM/SAM/SOM), projected CAGR, and lifecycle maturity stage.

## 2. Key Industry Trends & Growth Drivers
- **Technological Shift**: Impact of emerging tech.
- **Consumer / Market Behavior**: Changing customer expectations.
- **Macro & Regulatory Drivers**: Legislation, compliance, and economic climate.

## 3. Competitive Landscape & Key Players
| Player / Segment | Market Share / Position | Core Differentiators | Vulnerabilities |
| :--- | :--- | :--- | :--- |
| **Market Leader** | ... | ... | ... |
| **Emerging Challenger** | ... | ... | ... |

## 4. Opportunities, Threats & Barriers to Entry
- **Opportunities**: Underserved niches and expansion levers.
- **Threats**: Headwinds, disruption risks, and substitution.
- **Barriers to Entry**: Capital requirements, intellectual property, regulations.

## 5. Outlook & Strategic Recommendations
3–5 year strategic outlook and executive recommendations.
`,
      de: `# Marktanalyse: [Sektor / Branche / Nische]

## 1. Marktgröße & Wachstumsdynamik
Marktvolumen (TAM/SAM/SOM), prognostizierte CAGR und Reifegrad der Branche.

## 2. Branchentrends & Wachstumstreiber
- **Technologietrends**: Einfluss von Innovationen.
- **Markt- & Kundenverhalten**: Wandel der Nachfrage.
- **Regulatorische & Makro-Faktoren**: Rahmenbedingungen und Gesetze.

## 3. Wettbewerbsumfeld & Hauptakteure
| Anbieter / Segment | Marktposition | Stärken & USPs | Schwachstellen |
| :--- | :--- | :--- | :--- |
| **Marktführer** | ... | ... | ... |
| **Herausforderer** | ... | ... | ... |

## 4. Chancen, Risiken & Eintrittsbarrieren
- **Chancen**: Unerschlossene Marktpotenziale.
- **Risiken**: Bedrohungen und Disruption.
- **Eintrittsbarrieren**: Kapital, Know-how, Zertifizierungen.

## 5. Ausblick & Strategische Empfehlungen
Entwicklung der nächsten 3–5 Jahre und Handlungsempfehlungen.
`,
      es: `# Análisis de Mercado: [Sector / Industria / Nicho]

## 1. Tamaño del Mercado y Dinámica de Crecimiento
Estimación de volumen (TAM/SAM/SOM), CAGR previsto y ciclo de vida del sector.

## 2. Tendencias y Motores de Crecimiento
- **Tendencias Tecnológicas**: Innovaciones clave.
- **Demanda y Comportamiento**: Cambios en clientes.
- **Factores Regulatorios y Macroeconómicos**: Normativas e impacto económico.

## 3. Mapa de Competencia y Actores Principales
| Actor / Segmento | Posición en el mercado | Ventajas Competitivas | Vulnerabilidades |
| :--- | :--- | :--- | :--- |
| **Líder del mercado** | ... | ... | ... |
| **Challenger emergente** | ... | ... | ... |

## 4. Oportunidades, Amenazas y Barreras de Entrada
- **Oportunidades**: Nichos desatendidos.
- **Amenazas**: Riesgos de disrupción.
- **Barreras de Entrada**: Capital, patentes y regulaciones.

## 5. Perspectivas y Recomendaciones Estratégicas
Visión a 3–5 años y recomendaciones clave.
`,
      fr: `# Analyse de Marché : [Secteur / Industrie / Niche]

## 1. Taille du Marché et Dynamique de Croissance
Valorisation du marché (TAM/SAM/SOM), taux CAGR et phase de maturité.

## 2. Tendances Clés et Leviers de Croissance
- **Évolution Technologique**: Impact des innovations.
- **Comportement des Clients**: Nouvelles attentes.
- **Cadre Réglementaire et Macro-économie**: Législation et contexte économique.

## 3. Paysage Concurrentiel et Acteurs Majeurs
| Acteur / Segment | Part de marché / Posture | Avantages Compétitifs | Vulnérabilités |
| :--- | :--- | :--- | :--- |
| **Leader du marché** | ... | ... | ... |
| **Challenger innovant** | ... | ... | ... |

## 4. Opportunités, Menaces et Barrières à l'Entrée
- **Opportunités**: Segments porteurs.
- **Menaces**: Risques concurrentiels et substitution.
- **Barrières à l'Entrée**: Investissements, brevets et normes.

## 5. Perspectives et Recommandations Stratégiques
Trajectoire à 3–5 ans et orientations stratégiques.
`,
      it: `# Analisi di Mercato: [Settore / Industria / Nicchia]

## 1. Dimensioni del Mercato e Tasso di Crescita
Valutazione del mercato (TAM/SAM/SOM), CAGR previsto e fase di maturità.

## 2. Trend Chiave e Driver di Sviluppo
- **Innovazione Tecnologica**: Impatto delle nuove tecnologie.
- **Comportamento dei Clienti**: Nuove esigenze di mercato.
- **Quadro Normativo e Macroeconomico**: Vincoli e opportunità normative.

## 3. Mappa Competitiva e Principali Player
| Player / Segmento | Quota di Mercato / Posizione | Punti di Forza | Aree di Vulnerabilità |
| :--- | :--- | :--- | :--- |
| **Market Leader** | ... | ... | ... |
| **Challenger innovativo** | ... | ... | ... |

## 4. Opportunità, Minacce e Barriere all'Ingresso
- **Opportunità**: Nicchie ad alto potenziale.
- **Minacce**: Rischi di disintermediazione.
- **Barriere all'Ingresso**: Capitale, know-how, requisiti legali.

## 5. Previsioni e Conclusioni Strategiche
Evoluzione a 3-5 anni e raccomandazioni decisionali.
`,
      ja: `# 市場・業界動向分析: [セクター / 業界 / ニッチ分野]

## 1. 市場規模と成長性
市場規模の推計（TAM/SAM/SOM）、予測CAGR、および業界のライフサイクル段階。

## 2. 主要トレンドと成長ドライバー
- **技術動向**: 新技術の影響とイノベーション。
- **市場・顧客ニーズの変化**: 購買行動の変化。
- **規制・マクロ経済要因**: 法規制および経済環境。

## 3. 競合環境と主要プレイヤー
| プレイヤー / セグメント | 市場シェア / 立ち位置 | 競争優位性 (USP) | 課題・リスク |
| :--- | :--- | :--- | :--- |
| **市場リーダー** | ... | ... | ... |
| **新興チャレンジャー** | ... | ... | ... |

## 4. 機会、脅威、参入障壁
- **事業機会 (Opportunities)**: 未開拓セグメント。
- **事業脅威 (Threats)**: 破壊的イノベーションのリスク。
- **参入障壁**: 資本力、知的財産、許認可。

## 5. 今後の展望と戦略的提言
3〜5年の業界展望と事業戦略上の提言。
`,
      ko: `# 시장 및 산업 분석: [부문 / 산업 / 틈새 시장]

## 1. 시장 규모 및 성장 동학
시장 가치 추산(TAM/SAM/SOM), 예상 연평균 성장률(CAGR) 및 성숙도 단계.

## 2. 주요 산업 트렌드 및 성장 동력
- **기술 트렌드**: 혁신 기술의 영향.
- **수요 및 소비자 변화**: 시장 요구사항의 변화.
- **규제 및 거시경제 요인**: 관련 법규 및 거시경제 환경.

## 3. 경쟁 구도 및 주요 플레이어
| 기업 / 세그먼트 | 시장 점유율 / 포지셔닝 | 핵심 경쟁 우위 | 취약점 |
| :--- | :--- | :--- | :--- |
| **시장 선도 기업** | ... | ... | ... |
| **도전 기업 (Challenger)** | ... | ... | ... |

## 4. 기회, 위협 및 진입 장벽
- **기회 요인**: 미개척 시장 및 성장 기회.
- **위협 요인**: 대체재 위험 및 시장 불안정성.
- **진입 장벽**: 초기 자본, 기술 특허, 규제 요건.

## 5. 전망 및 전략적 권고사항
향후 3~5년 전망 및 실행 가능한 비즈니스 전략.
`,
      pt: `# Análise de Mercado: [Setor / Indústria / Nicho]

## 1. Dimensão do Mercado e Crescimento
Estimativa de volume (TAM/SAM/SOM), CAGR previsto e estágio do setor.

## 2. Tendências e Fatores de Impulso
- **Tendências Tecnológicas**: Inovações do setor.
- **Comportamento do Consumidor**: Mudanças na demanda.
- **Fatores Regulatórios e Econômicos**: Legislação e conjuntura.

## 3. Panorama Competitivo e Principais Players
| Player / Segmento | Posição no Mercado | Diferenciais Competitivos | Vulnerabilidades |
| :--- | :--- | :--- | :--- |
| **Líder de mercado** | ... | ... | ... |
| **Challenger emergente** | ... | ... | ... |

## 4. Oportunidades, Ameaças e Barreiras
- **Oportunidades**: Nichos inexplorados.
- **Ameaças**: Riscos de disrupção.
- **Barreiras de Entrada**: Capital, patentes e certificações.

## 5. Projeções e Recomendações Estratégicas
Cenário a 3–5 anos e recomendações para tomadores de decisão.
`,
      ru: `# Анализ Рынка: [Сектор / Отрасль / Ниша]

## 1. Объем Рынка и Динамика Роста
Оценка объемов (TAM/SAM/SOM), прогнозируемый CAGR и фаза зрелости.

## 2. Ключевые Тренды и Драйверы Роста
- **Технологические сдвиги**: Влияние инноваций.
- **Потребительские тренды**: Изменение структуры спроса.
- **Регуляторные и макрофакторы**: Законодательство и экономика.

## 3. Конкурентная Среда и Ключевые Игроки
| Игрок / Сегмент | Доля рынка / Позиция | Конкурентные преимущества | Уязвимости |
| :--- | :--- | :--- | :--- |
| **Лидер рынка** | ... | ... | ... |
| **Инновационный челленджер** | ... | ... | ... |

## 4. Возможности, Угрозы и Барьеры Входа
- **Возможности**: Незанятые ниши.
- **Угрозы**: Риски замедления и субституты.
- **Барьеры входа**: Капиталоемкость, патенты, лицензии.

## 5. Прогноз и Стратегические Выводы
Горизонт развития на 3–5 лет и стратегические рекомендации.
`,
      uk: `# Аналіз Ринку: [Сектор / Галузь / Ніша]

## 1. Обсяг Ринку та Динаміка Зростання
Оцінка обсягів (TAM/SAM/SOM), прогнозований CAGR та фаза зрілості.

## 2. Ключові Тренди та Драйвери Зростання
- **Технологічні зрушення**: Вплив інновацій.
- **Споживчі тренди**: Зміна структури попиту.
- **Регуляторні та макрофактори**: Законодавство та економіка.

## 3. Конкурентне Середовище та Головні Гравці
| Гравець / Сегмент | Частка ринку / Позиція | Конкурентні переваги | Вразливі місця |
| :--- | :--- | :--- | :--- |
| **Лідер ринку** | ... | ... | ... |
| **Інноваційний челенджер** | ... | ... | ... |

## 4. Можливості, Загрози та Бар'єри Входу
- **Можливості**: Неохоплені ніші.
- **Загрози**: Ризики уповільнення та замінники.
- **Бар'єри входу**: Капіталомісткість, патенти, ліцензії.

## 5. Прогноз і Стратегічні Висновки
Горизонт розвитку на 3–5 років і стратегічні рекомендації.
`,
      zh: `# 行业与市场分析: [赛道 / 行业 / 细分市场]

## 1. 市场规模与增长空间
市场容量估算（TAM/SAM/SOM）、复合年增长率（CAGR）与行业生命周期阶段。

## 2. 关键行业趋势与驱动因素
- **技术革新趋势**: 底层技术驱动与生产力跃迁。
- **需求与消费演变**: 客户核心诉求变化。
- **政策监管与宏观经济**: 产业政策、合规要求与经济环境。

## 3. 竞争格局与主要玩家矩阵
| 玩家 / 细分阵营 | 市场份额与定位 | 核心护城河 | 潜在短板 |
| :--- | :--- | :--- | :--- |
| **行业龙头** | ... | ... | ... |
| **高成长挑战者** | ... | ... | ... |

## 4. 商业机遇、风险与行业壁垒
- **商业机遇 (Opportunities)**: 差异化蓝海机会。
- **潜在威胁 (Threats)**: 跨界颠覆与替代品风险。
- **行业壁垒**: 资本规模、技术专利与牌照资质。

## 5. 趋势预判与战略建议
未来 3–5 年演变推演与落地战略建议。
`,
    },
    systemInstructions: {
      pl: 'Twórz rzetelne analizy rynkowe oparte na danych, wskaźnikach biznesowych i trendach. W tabelach rynkowych zachowuj zwięzłość komórek i czytelną strukturę kolumn. Kategoryzuj konkurentów, oceniaj dynamikę rynku i formułuj użyteczne wnioski strategiczne.',
      en: 'Deliver rigorous market analysis backed by business metrics, TAM/SAM sizing, concise competitive tables, and actionable strategic insights.',
      de: 'Erstelle fundierte Marktanalysen mit soliden Wirtschaftsdaten, kompakten Wettbewerbsmatrizen und strategischen Handlungsempfehlungen.',
      es: 'Elabora análisis de mercado rigurosos con datos financieros, tablas competitivas concisas y recomendaciones estratégicas claras.',
      fr: 'Rédigez des analyses sectorielles rigoureuses fondées sur des indicateurs économiques, des tableaux comparatifs concis et des recommandations stratégiques.',
      it: 'Conduci analisi di mercato accurate basate su metriche economiche, tabelle comparative sintetiche e raccomandazioni strategiche.',
      ja: '市場規模データ、簡潔な競合マトリクス表、業界トレンドに基づき、実践的で説得力のある市場分析を提供してください。',
      ko: '비즈니스 지표, 시장 규모 데이터, 간결한 경쟁 비교표에 근거하여 통찰력 있는 전략적 산업 분석 보고서를 작성하세요.',
      pt: 'Elabore análises de mercado aprofundadas com base em dados econômicos, matrizes comparativas concisas e diretrizes estratégicas.',
      ru: 'Готовьте основательный анализ рынка с опорой на экономические метрики, компактные сравнительные таблицы и стратегические рекомендации.',
      uk: 'Готуйте ґрунтовний аналіз ринку з опорою на економічні метрики, компактні порівняльні таблиці та стратегічні рекомендації.',
      zh: '基于详实商业数据、TAM/SAM 估算与紧凑清晰的竞争矩阵表，撰写具备高商业价值的行业分析报告。',
    },
  },

  // 5. Biographies / Historical Events
  {
    id: 'tpl-biography-history',
    icon: 'History',
    name: {
      pl: 'Biografie / historia wydarzeń',
      en: 'Biography & Historical Events',
      de: 'Biografien & Historische Ereignisse',
      es: 'Biografías e Historia de Eventos',
      fr: 'Biographies et Histoire d’Événements',
      it: 'Biografie e Storia degli Eventi',
      ja: '人物伝・歴史的出来事の記録',
      ko: '인물 전기 및 역사적 사건 탐구',
      pt: 'Biografias e História de Eventos',
      ru: 'Биографии и история событий',
      uk: 'Біографії та історія подій',
      zh: '人物传记与历史大事件纪实',
    },
    description: {
      pl: 'Chronologiczne i kontekstowe opracowanie sylwetki postaci lub genezy i przebiegu kluczowego wydarzenia.',
      en: 'Chronological and contextual account of historical figures or the origins, turning points, and lasting impact of pivotal events.',
      de: 'Chronologische und kontextuelle Aufarbeitung von Persönlichkeiten oder historischen Schlüsselereignissen.',
      es: 'Crónica cronológica y contextual de figuras históricas o de los orígenes y repercusiones de acontecimientos clave.',
      fr: 'Récit chronologique et contextuel de figures marquantes ou de la genèse et des conséquences d’événements historiques.',
      it: 'Trattazione cronologica e contestuale di figure storiche o della genesi ed evoluzione di eventi chiave.',
      ja: '歴史的人物の生涯や、重要な歴史的出来事の背景、経過、後世への影響を年代順に整理。',
      ko: '역사적 인물의 생애 또는 주요 역사적 사건의 발단, 전개 과정 및 후대에 미친 영향을 연대순으로 정리.',
      pt: 'Relato cronológico e contextual de personagens históricos ou de acontecimentos marcantes.',
      ru: 'Хронологический и контекстный разбор биографии деятеля или предпосылок и хода исторического события.',
      uk: 'Хронологічний та контекстний розбір біографії діяча або передумов і перебігу історичної події.',
      zh: '以严密时间线与时代大背景为脉络，系统剖析历史人物生平或重大会历史事件的起因、转折与深远遗产。',
    },
    content: {
      pl: `# Opracowanie: [Imię i Nazwisko Postaci / Nazwa Wydarzenia]

## 1. Wstęp i Znaczenie Historyczne
Kim była ta postać lub czym było to wydarzenie oraz dlaczego ma kluczowe znaczenie dla historii / dziedziny.

## 2. Oś Czasu i Kluczowe Daty (Kalendarium)
- **[Rok / Data]**: Przełomowy moment 1 – opis wydarzenia.
- **[Rok / Data]**: Przełomowy moment 2 – opis wydarzenia.
- **[Rok / Data]**: Przełomowy moment 3 – opis wydarzenia.

## 3. Tło Epoki i Przyczyny (Kontekst)
Warunki społeczno-polityczne, naukowe lub kulturowe, które ukształtowały bieg wydarzeń.

## 4. Główne Osiągnięcia / Przebieg i Następstwa
Dogłębna analiza dorobku postaci lub bezpośrednich i długofalowych konsekwencji wydarzenia.

## 5. Dziedzictwo, Wpływ i Ocena Współczesna
Jak postać/wydarzenie jest postrzegane dzisiaj, wnioski historyczne i wpływ na współczesność.
`,
      en: `# Historical Account: [Figure Name / Event Title]

## 1. Introduction & Significance
Who the figure was or what the event represented, and why it stands as a pivotal milestone.

## 2. Chronological Timeline & Milestones
- **[Year / Date]**: Milestone 1 – concise description.
- **[Year / Date]**: Milestone 2 – concise description.
- **[Year / Date]**: Milestone 3 – concise description.

## 3. Historical Context & Catalysts
Socio-political, intellectual, or cultural climate that shaped actions and outcomes.

## 4. Major Achievements / Course of Events & Aftermath
Comprehensive breakdown of contributions, critical decisions, or chain of consequences.

## 5. Legacy & Contemporary Perspective
Modern reception, lasting lessons, and enduring resonance in contemporary times.
`,
      de: `# Historische Abhandlung: [Persönlichkeit / Ereignis]

## 1. Einführung & Historische Bedeutung
Bedeutung der Persönlichkeit oder des Ereignisses im historischen Kontext.

## 2. Zeitleiste & Wichtigste Meilensteine
- **[Jahr / Datum]**: Meilenstein 1 – Beschreibung.
- **[Jahr / Datum]**: Meilenstein 2 – Beschreibung.

## 3. Epochenkontext & Ursachen
Gesellschaftliche, politische und kulturelle Rahmenbedingungen.

## 4. Hauptleistungen / Verlauf & Folgen
Analyse des Wirkens bzw. der direkten und langfristigen Auswirkungen.

## 5. Vermächtnis & Heutige Rezeption
Bedeutung aus heutiger Sicht und historische Lehren.
`,
      es: `# Crónica Histórica: [Nombre del Personaje / Evento]

## 1. Introducción y Relevancia Histórica
Quién fue la figura o qué significó el evento para la historia.

## 2. Cronología y Fechas Clave
- **[Año / Fecha]**: Hito 1 – descripción.
- **[Año / Fecha]**: Hito 2 – descripción.

## 3. Contexto de la Época y Causas
Entorno social, político o cultural que desencadenó los hechos.

## 4. Logros Principales / Desarrollo y Consecuencias
Analyse del legado o de la cadena de acontecimientos.

## 5. Legado y Visión Contemporánea
Impacto en el presente y lecciones históricas.
`,
      fr: `# Récit Historique : [Personnage / Événement]

## 1. Introduction et Portée Historique
Importance du personnage ou de l'événement dans l'Histoire.

## 2. Frise Chronologique et Dates Clés
- **[Année / Date]**: Étape 1 – description.
- **[Année / Date]**: Étape 2 – description.

## 3. Contexte d'Époque et Origines
Facteurs sociopolitiques ou intellectuels déterminants.

## 4. Réalisations Majeures / Déroulement et Conséquences
Analyse détaillée de l'œuvre ou des répercussions directes et différées.

## 5. Héritage et Regard Contemporain
Résonance actuelle et leçons de l'Histoire.
`,
      it: `# Profilo Storico: [Personaggio / Evento]

## 1. Introduzione e Rilevanza Storica
Inquadramento del personaggio o dell'evento storico.

## 2. Linea Temporale e Tappe Fondamentali
- **[Anno / Data]**: Tappa 1 – descrizione.
- **[Anno / Data]**: Tappa 2 – descrizione.

## 3. Contesto dell'Epoca e Cause
Contesto socioculturale e politico di riferimento.

## 4. Risultati Principali / Svolgimento e Conseguenze
Analisi dell'impatto storico e delle conseguenze.

## 5. Eredità e Valutazione Attuale
Riflessioni odierne e rilevanza contemporanea.
`,
      ja: `# 人物伝・歴史記録: [人物名 / 歴史的出来事の名称]

## 1. 導入と歴史的意義
対象の人物または出来事の概要と、歴史に与えた本質的な影響。

## 2. 年表と重要マイルストーン
- **[年 / 月日]**: 重要局面 1 – 詳細。
- **[年 / 月日]**: 重要局面 2 – 詳細。

## 3. 時代背景と起因 (コンテキスト)
出来事や行動を形作った社会的・政治的・文化的な背景。

## 4. 主な功績 / 経過と直接的・長期的影響
主要な業績や、歴史的展開とその後の影響の多角的な分析。

## 5. 後世への遺産と現代的評価
現代における評価、得られた教训、および現代社会への示唆。
`,
      ko: `# 역사 기록 및 인물 탐구: [인물명 / 역사적 사건명]

## 1. 도입 및 역사적 중요성
해당 인물 또는 사건의 핵심 의의와 역사적 위상.

## 2. 연대기 및 주요 사건 일지
- **[연도 / 일자]**: 주요 전환점 1 – 설명.
- **[연도 / 일자]**: 주요 전환점 2 – 설명.

## 3. 시대적 배경 및 발생 원인
사건이나 인물의 행보를 이끈 사회·정치·문화적 맥락.

## 4. 주요 업적 / 전개 과정 및 영향
인물의 주요 공헌 또는 사건의 직접적·장기적 파급 효과 분석.

## 5. 역사적 유산 및 현대적 평가
오늘날의 시각에서 바라본 평가와 역사적 교훈.
`,
      pt: `# Registo Histórico: [Nome da Figura / Evento]

## 1. Introdução e Relevância Histórica
Quem foi a personalidade ou o que representou o evento para a história.

## 2. Linha do Tempo e Marcos Principais
- **[Ano / Data]**: Marco 1 – descrição.
- **[Ano / Data]**: Marco 2 – descrição.

## 3. Contexto da Época e Causas
Ambiente sociopolítico e cultural que condicionou os acontecimentos.

## 4. Principais Feitos / Desenvolvimento e Consequências
Análise da obra da figura ou do encadeamento dos factos.

## 5. Legado e Perspetiva Contemporânea
Visão atual e lições para o presente.
`,
      ru: `# Исторический Очерк: [Имя деятеля / Название события]

## 1. Введение и Историческое Значение
Кем был деятель или в чем состояла суть события для истории.

## 2. Хронология и Ключевые Даты
- **[Год / Дата]**: Рубежный момент 1 – описание.
- **[Год / Дата]**: Рубежный момент 2 – описание.

## 3. Контекст Эпохи и Предпосылки
Социально-политические и культурные условия, определившие ход событий.

## 4. Главные Достижения / Ход Событий и Последствия
Анализ вклада личности или цепочки последствий события.

## 5. Наследие и Современная Оценка
Значение для современности и уроки истории.
`,
      uk: `# Історичний Нарис: [Ім'я діяча / Назва події]

## 1. Вступ та Історичне Значення
Ким був діяч або в чому полягала суть події для історії.

## 2. Хронологія та Ключові Дати
- **[Рік / Дата]**: Рубіжний момент 1 – опис.
- **[Рік / Дата]**: Рубіжний момент 2 – опис.

## 3. Контекст Епохи та Передумови
Соціально-політичні та культурні умови, що визначили перебіг подій.

## 4. Головні Досягнення / Перебіг Подій та Наслідки
Аналіз внеску особистості або ланцюга наслідків події.

## 5. Спадщина та Сучасна Оцінка
Значення для сьогодення та уроки історії.
`,
      zh: `# 历史人物与事件纪实: [人物姓名 / 历史事件名称]

## 1. 概述与核心历史地位
该人物的身份定位或重大事件的核心意义，以及为何成为关键历史里程碑。

## 2. 年表纪事与关键转折点
- **[年份 / 日期]**: 关键节点 1 – 具体过程。
- **[年份 / 日期]**: 关键节点 2 – 具体过程。

## 3. 时代大背景与诱发根源 (Context)
塑造历史轨迹的社会制度、地缘政治与思想文化背景。

## 4. 核心历史功过 / 事件全过程与深远影响
人物生平核心功绩剖析，或事件直接演变过程与连锁后果。

## 5. 历史遗产与当代启示
当今学术与公众视角下的评价、经验教训与现实意义。
`,
    },
    systemInstructions: {
      pl: 'Dbaj o ścisłą chronologię faktów, wierność historyczną i neutralny, rzetelny ton narracji. Podkreślaj przyczyny i skutki oraz kontekst epoki.',
      en: 'Maintain strict chronological accuracy, contextual depth, and a measured historical narrative highlighting causality and lasting legacy.',
      de: 'Achte auf präzise Chronologie, historischen Kontext, Ursache-Wirkungs-Zusammenhänge und eine neutrale Tonalität.',
      es: 'Mantén una rigurosa precisión cronológica, contextualiza los hechos y analiza con neutralidad las causas y consecuencias.',
      fr: 'Respectez la rigueur chronologique et contextuelle, en mettant en lumière les liens de causalité et la portée historique.',
      it: 'Mantieni rigore cronologico e profondità contestuale, evidenziando cause, effetti e valore storico.',
      ja: '厳密な年代順の正確さを保ち、時代背景と因果関係を客観的かつ明快に記述してください。',
      ko: '엄밀한 연대순 서술과 시대적 배경을 반영하고, 인과관계와 역사적 교훈을 균형 있게 다루세요.',
      pt: 'Mantenha rigor cronológico e profundidade contextual, evidenciando causas, consequências e legado histórico.',
      ru: 'Соблюдайте строгую хронологическую точность, нейтральный тон и детально раскрывайте причинно-следственные связи.',
      uk: 'Дотримуйтеся суворої хронологічної точності, нейтрального тону та детально розкривайте причинно-наслідкові зв’язки.',
      zh: '注重历史纪实的严谨性与编年准确性，深入还原时代背景，客观分析因果律与后世启示。',
    },
  },

  // 6. "How it works" Documentation for External Technologies
  {
    id: 'tpl-tech-how-it-works',
    icon: 'Cpu',
    name: {
      pl: 'Dokumentacja „Jak to działa” dla technologii',
      en: 'Technology Under the Hood / How It Works',
      de: '„Wie es funktioniert“-Technologiedokumentation',
      es: 'Documentación «Cómo Funciona» de Tecnologías',
      fr: 'Documentation « Comment ça marche » (Under the Hood)',
      it: 'Documentazione «Come Funziona» delle Tecnologie',
      ja: '技術の仕組み・内部構造ドキュメント',
      ko: '외부 기술 내부 동작 원리 (How It Works)',
      pt: 'Documentação «Como Funciona» de Tecnologias',
      ru: 'Документация «Как это устроено» для технологий',
      uk: 'Документація «Як це працює» для технологій',
      zh: '外部技术底层工作原理解析 (How It Works)',
    },
    description: {
      pl: 'Techniczne rozłożenie na czynniki pierwsze działania technologii, protokołu lub biblioteki pod maską.',
      en: 'Deep-dive architectural breakdown explaining the internal mechanics, pipeline flow, and algorithms of external systems/tools.',
      de: 'Technische Tiefenanalyse zur internen Funktionsweise, Datenpipeline und Kernalgorithmen von Technologien.',
      es: 'Desglose técnico de la arquitectura interna, flujo de peticiones y algoritmos de una tecnología.',
      fr: 'Analyse technique approfondie de l’architecture interne, du pipeline de traitement et des algorithmes d’une technologie.',
      it: 'Analisi tecnica approfondita su architettura interna, pipeline di esecuzione e algoritmi di una tecnologia.',
      ja: '外部技術、プロトコル、フレームワークの内部アーキテクチャ、処理パイプライン、コアアルゴリズムを徹底解剖。',
      ko: '외부 기술, 프로토콜 및 라이브러리의 내부 아키텍처, 요청 처리 파이프라인 및 핵심 알고리즘 심층 분석.',
      pt: 'Análise técnica da arquitetura interna, fluxo de processamento e algoritmos de uma tecnologia.',
      ru: 'Инженерный разбор внутреннего устройства, пайплайна данных и алгоритмов сторонней технологии.',
      uk: 'Інженерний розбір внутрішнього устрою, пайплайну даних та алгоритмів сторонньої технології.',
      zh: '从底层架构、内部数据流转 Pipeline、核心数据结构到关键算法的系统级工作原理解构。',
    },
    content: {
      pl: `# Jak to działa pod maską: [Nazwa Technologii / Narzędzia]

## 1. Przegląd Architektury i Cel
Krótkie wyjaśnienie, co dana technologia robi, jakie problemy rozwiązuje i jak wygląda jej architektura wysokopoziomowa.

## 2. Kluczowe Komponenty i Moduły Wewnętrzne
- **Komponent 1 (np. Engine / Core)**: Rola w przetwarzaniu i odpowiedzialność.
- **Komponent 2 (np. Storage / Cache)**: Mechanizm składowania i synchronizacji.
- **Komponent 3 (np. Protocol / Network)**: Warstwa komunikacji.

## 3. Przepływ Przetwarzania Krok po Kroku (Lifecycle / Pipeline)
1. **Inicjalizacja / Wejście**: Co dzieje się po odebraniu zdarzenia lub polecenia.
2. **Transformacja / Przetwarzanie**: Wewnętrzny obieg danych i logika biznesowa.
3. **Emisja / Zapis**: Zwrócenie odpowiedzi i utrwalenie stanu.

## 4. Wewnętrzne Struktury Danych i Algorytmy
Opis kluczowych algorytmów (np. indeksowanie, konsensus, optymalizacje pamięciowe).

## 5. Dobre Praktyki, Optymalizacje i Pułapki
Wskazówki integracyjne, wydajnościowe oraz częste wąskie gardła.
`,
      en: `# Under the Hood: [Technology / Protocol / Tool Name]

## 1. Architectural Overview & Purpose
High-level purpose, problem space addressed, and overall architectural topology.

## 2. Core Internal Modules & Subsystems
- **Module 1 (e.g., Core Engine / Parser)**: Primary execution responsibility.
- **Module 2 (e.g., State Store / Buffer)**: Data persistence and caching mechanics.
- **Module 3 (e.g., Transport / Adapter)**: Protocol interfaces and networking layer.

## 3. Step-by-Step Processing Pipeline (Request Lifecycle)
1. **Ingestion / Dispatch**: Initial handling upon receiving input or trigger.
2. **Processing & State Transition**: Core algorithms and internal transforms.
3. **Output & Finalization**: Response emission and commit logic.

## 4. Data Structures & Core Algorithms
Key algorithms (e.g., indexing schemes, consensus, memory management, serialization).

## 5. Production Best Practices & Failure Modes
Integration gotchas, tuning knobs, and performance optimization guidelines.
`,
      de: `# Unter der Haube: [Technologie / Tool]

## 1. Architekturüberblick & Zweck
Aufgabenbereich, gelöste Probleme und Gesamttopologie.

## 2. Kernkomponenten & Subsysteme
- **Komponente 1 (z. B. Core Engine)**: Hauptfunktion.
- **Komponente 2 (z. B. State / Cache)**: Speicher- und Synchronisationslogik.

## 3. Verarbeitungs-Pipeline Schritt für Schritt
1. **Eingang / Trigger**: Ablauf beim Empfang.
2. **Verarbeitung**: Transformation und Ausführung.
3. **Ausgabe**: Rückgabe und Zustandsspeicherung.

## 4. Datenstrukturen & Algorithmen
Wichtigste Algorithmen (z. B. Indizierung, Caching, Ressourcenverwaltung).

## 5. Best Practices & Stolpersteine
Leitlinien für Performance, Debugging und typische Fallstricke.
`,
      es: `# Cómo Funciona por Dentro: [Tecnología / Herramienta]

## 1. Visión General de la Arquitectura
Objetivo, problemas resueltos y topología general.

## 2. Módulos y Subsistemas Principales
- **Módulo 1 (Core / Parser)**: Función principal.
- **Módulo 2 (Almacén / Caché)**: Gestión del estado.

## 3. Pipeline de Ejecución Paso a Paso
1. **Recepción / Disparo**: Flujo inicial de entrada.
2. **Transformación**: Lógica de procesamiento interno.
3. **Respuesta**: Emisión del resultado.

## 4. Estructuras de Datos y Algoritmos
Algoritmos clave (indexación, concurrencia, gestión de memoria).

## 5. Mejores Prácticas y Puntos Críticos
Recomendaciones de rendimiento y errores comunes de integración.
`,
      fr: `# Sous le Capot : [Technologie / Outil]

## 1. Vue d'Ensemble de l'Architecture
Objectifs, problématiques résolues et architecture globale.

## 2. Composants Internes et Sous-systèmes
- **Composant 1 (Moteur / Parseur)**: Rôle clé dans l'exécution.
- **Composant 2 (Gestionnaire d'état)**: Mécanisme de persistance.

## 3. Pipeline de Traitement Étape par Étape
1. **Réception**: Prise en charge initiale de la requête.
2. **Traitement**: Transformation et exécution algorithmique.
3. **Restitution**: Émission du résultat final.

## 4. Structures de Données et Algorithmes
Algorithmes fondamentaux (indexation, sérialisation, consensus).

## 5. Bonnes Pratiques et Pièges à Éviter
Optimisations, dimensionnement et pièges fréquents.
`,
      it: `# Dietro le Quinte: [Tecnologia / Strumento]

## 1. Panoramica dell'Architettura
Scopo, contesto d'uso e schema architetturale.

## 2. Moduli Interni e Sottosistemi
- **Modulo 1 (Engine Core)**: Responsabilità principale.
- **Modulo 2 (Gestione Stato / Cache)**: Persistenza e sincronizzazione.

## 3. Pipeline di Elaborazione Passo per Passo
1. **Ingresso**: Gestione iniziale della richiesta.
2. **Elaborazione**: Flusso logico ed esecuzione.
3. **Emissione**: Risposta finale e persistenza.

## 4. Strutture Dati e Algoritmi Chiave
Algoritmi determinanti (indicizzazione, allocazione memoria, serializzazione).

## 5. Best Practice e Criticità
Ottimizzazioni prestazionali e rischi di integrazione.
`,
      ja: `# 内部構造と仕組み: [テクノロジー名 / プロトコル名]

## 1. アーキテクチャ概要と目的
対象技術が解決する課題、高水準アーキテクチャ、および設計思想。

## 2. 主要な内部モジュールとサブシステム
- **モジュール 1 (例: コアエンジン / パーサー)**: 実行責務と役割。
- **モジュール 2 (例: 状態管理 / キャッシュ層)**: データの永続化と同期方式。
- **モジュール 3 (例: トランスポート / ネットワーク層)**: 通信制御。

## 3. リクエスト処理フロー (ライフサイクル / パイプライン)
1. **受付・初期化**: リクエスト受信時の初動処理。
2. **変換・コア処理**: 内部アルゴリズムと状態遷移。
3. **応答・コミット**: 結果の返却と状態の確定。

## 4. 内部データ構造と主要アルゴリズム
核となるアルゴリズム（インデックス構造、メモリ管理、並行性制御など）。

## 5. 本番運用のベストプラクティスと注意点
パフォーマンス最適化の指針と典型的なボトルネックの回避策。
`,
      ko: `# 동작 원리 심층 분석: [기술 / 도구 / 프로토콜 명칭]

## 1. 아키텍처 개요 및 설계 목적
기술의 도입 목적, 해결하는 문제 및 전체 아키텍처 구성도.

## 2. 핵심 내부 모듈 및 서브시스템
- **모듈 1 (예: Core Engine / Parser)**: 실행 책임 및 역할.
- **모듈 2 (예: State Manager / Storage)**: 데이터 저장 및 동기화 메커니즘.
- **모듈 3 (예: Network / Protocol)**: 통신 인터페이스 계층.

## 3. 요청 처리 파이프라인 (Life of a Request)
1. **수신 및 디스패치**: 입력 이벤트 인입 시 초기 동작.
2. **변환 및 처리**: 내부 알고리즘 수행 및 상태 전이.
3. **출력 및 완료**: 응답 반환 및 상태 커밋.

## 4. 핵심 데이터 구조 및 알고리즘
핵심 알고리즘(인덱싱, 동시성 제어, 메모리 최적화 등) 분석.

## 5. 실전 최적화 팁 및 주의사항
성능 튜닝 포인트 및 흔히 겪는 병목 현상 대응책.
`,
      pt: `# Por Dentro da Tecnologia: [Nome da Tecnologia / Ferramenta]

## 1. Visão Geral da Arquitetura
Propósito central, problemas solucionados e topologia.

## 2. Módulos e Subsistemas Internos
- **Módulo 1 (Core / Parser)**: Função de execução.
- **Módulo 2 (Estado / Cache)**: Persistência e memória.

## 3. Pipeline de Processamento Passo a Passo
1. **Entrada**: Recepção inicial do evento.
2. **Processamento**: Transformações e algoritmos.
3. **Saída**: Finalização e retorno.

## 4. Estruturas de Dados e Algoritmos
Algoritmos essenciais (indexação, serialização, consenso).

## 5. Boas Práticas e Gargalos
Orientações de desempenho e armadilhas comuns.
`,
      ru: `# Под Капотом: [Название технологии / инструмента]

## 1. Архитектурный Обзор и Назначение
Цели инструмента, решаемые задачи и топология компонентов.

## 2. Ключевые Подсистемы и Модули
- **Модуль 1 (Ядро / Парсер)**: Основные функции обработки.
- **Модуль 2 (Хранилище состояния)**: Кэширование и персистентность.

## 3. Пошаговый Пайплайн Обработки Запроса
1. **Входной сигнал**: Начальная обработка события.
2. **Трансформация**: Внутренняя логика и расчеты.
3. **Финализация**: Отдача ответа и фиксация состояния.

## 4. Структуры Данных и Алгоритмы
Ключевые алгоритмы (индексация, управление памятью, консенсус).

## 5. Практические Советы и Узкие Места
Оптимизация производительности и типичные ошибки интеграции.
`,
      uk: `# Під Капотом: [Назва технології / інструменту]

## 1. Архітектурний Огляд і Призначення
Цілі інструменту, задачі, що вирішуються, та топологія компонентів.

## 2. Ключові Підсистеми та Модулі
- **Модуль 1 (Ядро / Парсер)**: Основні функції обробки.
- **Модуль 2 (Сховище стану)**: Кешування та персистентність.

## 3. Покроковий Пайплайн Обробки Запиту
1. **Вхідний сигнал**: Початкова обробка події.
2. **Трансформація**: Внутрішня логіка та розрахунки.
3. **Фіналізація**: Віддача відповіді та фіксація стану.

## 4. Структури Даних та Алгоритми
Ключові алгоритми (індексація, керування пам'яттю, консенсус).

## 5. Практичні Поради та Вузькі Місця
Оптимізація продуктивності та типові помилки інтеграції.
`,
      zh: `# 底层工作原理解构: [技术组件 / 协议 / 工具名称]

## 1. 系统架构全景与核心目标
高阶架构拓扑图、核心解决的问题域及系统设计哲学。

## 2. 内部核心模块与子系统
- **核心模块 1 (如 Core Engine / Parser)**: 核心执行职责。
- **核心模块 2 (如 State Store / Cache)**: 数据状态持久化与同步机制。
- **核心模块 3 (如 Transport / Network)**: 协议通信与适配层。

## 3. 请求生命周期与执行流水线 (Request Pipeline)
1. **请求摄入与分发**: 事件触发与前置校验。
2. **核心计算与状态流转**: 底层算法执行与数据变形。
3. **提交与响应回写**: 状态落盘与结果输出。

## 4. 核心数据结构与底层算法
核心算法剖析（如高并发索引、内存管理、一致性协议与序列化）。

## 5. 生产实践、性能调优与避坑指南
工程落地关键调优参数与典型性能瓶颈排查。
`,
    },
    systemInstructions: {
      pl: 'Pisz z perspektywy inżyniera / architekta oprogramowania. Wyjaśniaj przepływ danych krok po kroku (under the hood), wewnętrzne moduły, algorytmy oraz kwestie wydajnościowe.',
      en: 'Adopt a software architect perspective: unpack under-the-hood data flows, explain internal modules, detail algorithms, and address performance characteristics.',
      de: 'Schreibe aus der Perspektive eines Software-Architekten: erkläre interne Datenflüsse, Modulinteraktionen, Algorithmen und Performance-Aspekte.',
      es: 'Adopta el punto de vista de un arquitecto de software: detalla el flujo de datos interno, módulos, algoritmos y rendimiento.',
      fr: 'Rédigez sous l’angle d’un architecte logiciel : détaillez les flux de données internes, les modules, les algorithmes et la performance.',
      it: 'Scrivi con la prospettiva di un software architect: illustra il flusso dati interno, i moduli, gli algoritmi e le prestazioni.',
      ja: 'ソフトウェアアーキテクトの視点で、内部データフロー、サブシステム連携、コアアルゴリズム、パフォーマンス特性を分かりやすく解説してください。',
      ko: '소프트웨어 아키텍트의 관점에서 내부 데이터 흐름, 핵심 모듈의 동작 원리, 알고리즘 및 성능 튜닝 방안을 심도 있게 설명하세요.',
      pt: 'Escreva sob a ótica de um arquiteto de software: detalhe fluxos de dados internos, módulos, algoritmos e desempenho.',
      ru: 'Пишите с позиции инженера/архитектора: детально раскрывайте внутренние потоки данных, алгоритмы и вопросы производительности.',
      uk: 'Пишіть з позиції інженера/архітектора: детально розкривайте внутрішні потоки даних, алгоритми та питання продуктивності.',
      zh: '站在资深软件架构师的视角，深入剖析内部数据流转细节、核心子系统协作、底层算法实现与性能瓶颈调优。',
    },
  },

  // 7. Literature Reviews / Research Summaries
  {
    id: 'tpl-literature-review',
    icon: 'BookOpen',
    name: {
      pl: 'Przeglądy literatury / podsumowania badań',
      en: 'Literature Review & Research Synthesis',
      de: 'Literaturüberblick & Forschungssynthese',
      es: 'Revisión de Literatura y Síntesis de Investigación',
      fr: 'Revue de Littérature et Synthèse de Recherche',
      it: 'Rassegna della Letteratura e Sintesi della Ricerca',
      ja: '文献レビュー・研究論文サマリー',
      ko: '문헌 고찰 및 선행 연구 종합 분석',
      pt: 'Revisão de Literatura e Síntese de Pesquisa',
      ru: 'Обзоры литературы и синтез исследований',
      uk: 'Огляди літератури та синтез досліджень',
      zh: '文献综述与学术研究综合评估',
    },
    description: {
      pl: 'Przegląd publikacji naukowych i badań w dziedzinie z syntezą metodologii, ustaleń i luk badawczych.',
      en: 'Structured review of scientific literature, summarizing study methodologies, conflicting findings, and identified research gaps.',
      de: 'Strukturierte Auswertung wissenschaftlicher Publikationen mit Methodensynthese, Befunden und Forschungslücken.',
      es: 'Revisión estructurada de publicaciones académicas con síntesis metodológica, hallazgos y lagunas investigativas.',
      fr: 'Synthèse structurée de publications scientifiques, des méthodologies, des résultats et des perspectives de recherche.',
      it: 'Rassegna strutturata di pubblicazioni scientifiche con sintesi di metodologie, risultati e gap della ricerca.',
      ja: '学術論文・研究発表を体系的にレビューし、研究手法、主要な知見、未解決の研究課題（リサーチギャップ）を統合。',
      ko: '학술 논문 및 연구 자료를 체계적으로 고찰하고 연구 방법론, 주요 발견 및 미해결 연구 공백(Research Gap)을 종합 정리.',
      pt: 'Revisão estruturada de artigos científicos com síntese de metodologias, conclusões e lacunas de pesquisa.',
      ru: 'Систематический обзор научных публикаций с анализом методологий, результатов и исследовательских пробелов.',
      uk: 'Систематичний огляд наукових публікацій з аналізом методологій, результатів та дослідницьких прогалин.',
      zh: '对领域内学术文献与实验研究的结构化综述，涵盖研究方法论、结论争议点及未来研究空白（Research Gaps）。',
    },
    content: {
      pl: `# Przegląd Literatury i Badań: [Obszar Badawczy]

## 1. Cel Przeglądu i Kryteria Doboru
Zdefiniowanie pytania badawczego oraz kryteriów doboru analizowanych publikacji i źródeł.

## 2. Tabela Podsumowująca Analizowane Prace
| Autor(zy) i Rok | Tytuł pracy / Źródło | Zastosowana Metodologia | Główne Ustalenia |
| :--- | :--- | :--- | :--- |
| **[Badacz 1 (2024)]** | [Tytuł publikacji] | Badanie ilościowe / Eksperyment | Kluczowy wynik |
| **[Badacz 2 (2023)]** | [Tytuł publikacji] | Metaanaliza / Przegląd | Kluczowy wynik |

## 3. Główne Nurty Teoretyczne i Punkty Sporne
- **Dominujący paradygmat**: Ustalenia wspólne dla większości badaczy.
- **Kontrowersje i rozbieżności**: Obszary sprzeczności w wynikach badań.

## 4. Zidentyfikowane Luki Badawcze (Research Gaps)
Czego dotychczasowe publikacje jeszcze nie wyjaśniły i jakie pytania pozostają otwarte.

## 5. Synteza i Wnioski Końcowe
Podsumowanie stanu wiedzy oraz implikacje teoretyczne i praktyczne.
`,
      en: `# Literature Review: [Research Area / Topic]

## 1. Scope, Objectives & Selection Criteria
Research question formulation and inclusion/exclusion criteria for examined literature.

## 2. Summary Matrix of Reviewed Studies
| Author(s) & Year | Title / Journal | Methodology Applied | Core Findings |
| :--- | :--- | :--- | :--- |
| **[Researcher A (2024)]** | [Paper Title] | Quantitative / Empirical Trial | Primary finding |
| **[Researcher B (2023)]** | [Paper Title] | Meta-analysis / Systematic Review | Primary finding |

## 3. Theoretical Themes & Scientific Debates
- **Prevailing Consensus**: Widely accepted conclusions across the literature.
- **Discrepancies & Debates**: Areas of conflicting experimental outcomes.

## 4. Identified Research Gaps
Unresolved questions, methodological blindspots, and opportunities for future inquiry.

## 5. Synthesis & Conclusions
Integrated summary of the current state of knowledge and broader implications.
`,
      de: `# Literaturüberblick: [Forschungsfeld]

## 1. Zielsetzung & Auswahlkriterien
Forschungsfrage und Kriterien für die Literaturauswahl.

## 2. Übersichtstabelle der untersuchten Arbeiten
| Autor(en) & Jahr | Titel / Quelle | Methodik | Hauptergebnisse |
| :--- | :--- | :--- | :--- |
| **[Forscher 1 (2024)]** | [Titel] | Quantitativ / Experiment | Kernergebnis |
| **[Forscher 2 (2023)]** | [Titel] | Metaanalyse | Kernergebnis |

## 3. Theoretische Strömungen & Kontroversen
- **Wissenschaftlicher Konsens**: Weithin anerkannte Thesen.
- **Kontroversen**: Uneinheitliche Forschungsergebnisse.

## 4. Forschungslücken (Research Gaps)
Offene Fragestellungen und methodische Defizite bisheriger Studien.

## 5. Gesamtfazit & Implikationen
Synthese des aktuellen Forschungsstandes und Ausblick.
`,
      es: `# Revisión de Literatura: [Área de Investigación]

## 1. Objetivos y Criterios de Selección
Pregunta de investigación y criterios de inclusión de fuentes.

## 2. Matriz de Estudios Analizados
| Autor(es) y Año | Título / Fuente | Metodología | Conclusiones Principales |
| :--- | :--- | :--- | :--- |
| **[Investigador 1 (2024)]** | [Título] | Cuantitativa / Ensayo | Resultado clave |
| **[Investigador 2 (2023)]** | [Título] | Metaanálisis | Resultado clave |

## 3. Corrientes Teóricas y Puntos de Debate
- **Consenso Científico**: Hallazgos compartidos.
- **Controversias**: Discrepancias entre estudios.

## 4. Lagunas de Investigación (Research Gaps)
Aspectos aún no resueltos por la literatura existente.

## 5. Síntesis y Conclusiones
Estado actual del conocimiento e implicaciones prácticas.
`,
      fr: `# Revue de Littérature : [Domaine de Recherche]

## 1. Objectifs et Critères de Sélection
Définition de la question de recherche et critères de sélection des publications.

## 2. Tableau Synthétique des Études Examinées
| Auteur(s) et Année | Titre / Revue | Méthodologie | Principaux Résultats |
| :--- | :--- | :--- | :--- |
| **[Chercheur 1 (2024)]** | [Titre] | Quantitative / Expérimentation | Constat majeur |
| **[Chercheur 2 (2023)]** | [Titre] | Méta-analyse | Constat majeur |

## 3. Courants Théoriques et Débats
- **Consensus Dominant**: Thèses largement admises.
- **Controverses**: Divergences méthodologiques ou empiriques.

## 4. Lacunes Identifiées (Research Gaps)
Questions scientifiques encore en suspens.

## 5. Synthèse et Perspectives
État de l'art et pistes pour de futurs travaux.
`,
      it: `# Rassegna della Letteratura: [Area di Ricerca]

## 1. Obiettivi e Criteri di Selezione
Quesito di ricerca e criteri di inclusione degli studi.

## 2. Matrice degli Studi Analizzati
| Autore/i e Anno | Titolo / Fonte | Metodologia | Risultati Chiave |
| :--- | :--- | :--- | :--- |
| **[Autore 1 (2024)]** | [Titolo] | Quantitativa / Sperimentale | Esito principale |
| **[Autore 2 (2023)]** | [Titolo] | Meta-analisi | Esito principale |

## 3. Temi Teorici e Punti di Disaccordo
- **Consenso Prevalente**: Conclusioni ampiamente condivise.
- **Controversie**: Risultati contrastanti nella letteratura.

## 4. Gap della Ricerca (Research Gaps)
Aspetti ancora non chiariti dagli studi disponibili.

## 5. Sintesi e Conclusioni
Quadro generale dello stato della conoscenza e sviluppi futuri.
`,
      ja: `# 文献レビュー・研究サマリー: [研究分野・対象テーマ]

## 1. レビューの目的と論文選定基準
研究課題の設定および対象とする学術文献の選定・除外基準。

## 2. 対象論文の概要比較マトリクス
| 著者・発表年 | 論文タイトル / 掲載誌 | 研究手法・方法論 | 主な研究結果 |
| :--- | :--- | :--- | :--- |
| **[研究者 A (2024)]** | [論文名] | 定量調査 / 実証実験 | 主要な知見 |
| **[研究者 B (2023)]** | [論文名] | メタアナリシス / 系統的レビュー | 主要な知見 |

## 3. 主な学術的潮流と議論の対立点
- **学術的コンセンサス**: 広く支持されている共通の結論。
- **見解の相違と論争点**: 研究間で結果が分かれている論点。

## 4. リサーチギャップ（未解決の研究課題）
これまでの研究で解明されていない点や今後の課題。

## 5. 総合評価と今後の展望
知見の統合的まとめと学術的・実践的インプリケーション。
`,
      ko: `# 문헌 고찰 및 연구 종합: [연구 분야 / 주제]

## 1. 연구 목적 및 문헌 선정 기준
연구 질문 설정 및 분석 대상 학술 문헌의 선정/배제 기준.

## 2. 주요 선행 연구 비교 매트릭스
| 연구자 및 연도 | 논문 제목 / 게재지 | 적용 방법론 | 핵심 연구 결과 |
| :--- | :--- | :--- | :--- |
| **[연구자 1 (2024)]** | [논문 제목] | 양적 연구 / 실증 실험 | 주요 결론 |
| **[연구자 2 (2023)]** | [논문 제목] | 메타분석 / 체계적 고찰 | 주요 결론 |

## 3. 주요 이론적 조류 및 학술적 쟁점
- **지배적 학술 합의**: 학계에서 보편적으로 인정받는 사실.
- **상충되는 연구 결과**: 학자 간 견해가 대립하는 쟁점.

## 4. 연구 공백 (Research Gaps)
기존 문헌에서 규명되지 않은 미해결 질문 및 연구 한계.

## 5. 종합 평가 및 제언
현재 학술적 지식 수준의 종합 및 향후 연구 방향 제언.
`,
      pt: `# Revisão da Literatura: [Área de Pesquisa]

## 1. Objetivos e Critérios de Seleção
Pergunta de pesquisa e critérios de inclusão das publicações.

## 2. Matriz dos Estudos Analisados
| Autor(es) e Ano | Título / Revista | Metodologia | Principais Resultados |
| :--- | :--- | :--- | :--- |
| **[Autor 1 (2024)]** | [Título] | Quantitativa / Ensaio | Conclusão principal |
| **[Autor 2 (2023)]** | [Título] | Meta-análise | Conclusão principal |

## 3. Correntes Teóricas e Divergências
- **Consenso Científico**: Achados amplamente aceitos.
- **Controvérsias**: Áreas de resultados conflitantes.

## 4. Lacunas de Pesquisa (Research Gaps)
Questões ainda não respondidas pela literatura.

## 5. Síntese e Conclusões
Estado atual da arte e implicações futuras.
`,
      ru: `# Обзор Литературы: [Область Исследований]

## 1. Цели Обзора и Критерии Отбора
Постановка исследовательского вопроса и критерии включения научных работ.

## 2. Сводная Таблица Анализируемых Работ
| Автор(ы) и Год | Название публикации | Методология | Главные Результаты |
| :--- | :--- | :--- | :--- |
| **[Исследователь 1 (2024)]** | [Название статьи] | Количественный анализ | Ключевой вывод |
| **[Исследователь 2 (2023)]** | [Название статьи] | Метаанализ | Ключевой вывод |

## 3. Теоретические Направления и Дискуссии
- **Научный консенсус**: Общепринятые положения.
- **Противоречия**: Несовпадения в результатах исследований.

## 4. Исследовательские Пробелы (Research Gaps)
Белые пятна и нерешенные вопросы в текущей литературе.

## 5. Синтез и Итоговые Выводы
Обобщение современного состояния знаний и направления работы.
`,
      uk: `# Огляд Літератури: [Галузь Досліджень]

## 1. Мета Огляду та Критерії Відбору
Постановка дослідницького питання та критерії відбору наукових праць.

## 2. Зведена Таблиця Аналізованих Робіт
| Автор(и) та Рік | Назва публікації | Методологія | Головні Результати |
| :--- | :--- | :--- | :--- |
| **[Дослідник 1 (2024)]** | [Назва статті] | Кількісний аналіз | Ключовий висновок |
| **[Дослідник 2 (2023)]** | [Назва статті] | Метааналіз | Ключовий висновок |

## 3. Теоретичні Напрямки та Дискусії
- **Науковий консенсус**: Загальноприйняті положення.
- **Суперечності**: Розбіжності в результатах досліджень.

## 4. Дослідницькі Прогалини (Research Gaps)
Білі плями та невирішені питання в сучасній літературі.

## 5. Синтез та Підсумкові Висновки
Узагальнення сучасного стану знань та напрямки роботи.
`,
      zh: `# 文献综述与学术评估: [学术研究领域 / 课题名称]

## 1. 综述目标与文献检索标准
明确核心研究问题、文献检索范围及纳入/排除标准。

## 2. 核心文献与实证研究对比矩阵
| 作者与年份 | 论文题目 / 来源期刊 | 研究方法论 (量化/质性) | 核心实验结论 |
| :--- | :--- | :--- | :--- |
| **[研究团队 A (2024)]** | [论文题目] | 严格对照实验 / 统计建模 | 核心结论 |
| **[研究团队 B (2023)]** | [论文题目] | 荟萃分析 (Meta-analysis) | 核心结论 |

## 3. 主流理论流派与学界争议焦点
- **学界主流共识**: 被广泛验证并接受的核心结论。
- **学术争议与结论分歧**: 不同实验条件下结论相左的焦点领域。

## 4. 关键研究空白识别 (Research Gaps)
现有学术成果尚未完全解答的关键盲区与未来突破方向。

## 5. 综合评估与研究结论
系统总结领域研究现状、理论贡献与工程实践指导意义。
`,
    },
    systemInstructions: {
      pl: 'Twórz rzetelny, akademicki przegląd literatury. W tabelach syntezy badań stosuj zwięzłe formuły metryczne i wnioski. Kategoryzuj metodologie, rygorystycznie cytuj źródła [1], [2], wyodrębniaj luki badawcze (Research Gaps) i rozpisuj szczegóły w sekcjach analitycznych.',
      en: 'Deliver rigorous, academic-grade literature syntheses with concise comparative matrices. Group methodologies, cite sources diligently with [1], [2], isolate research gaps, and detail analysis in subsequent sections.',
      de: 'Erstelle fundierte akademische Literatursynthesen mit kompakten Vergleichstabellen. Kategorisiere Methoden, zitiere Quellen [1], [2], benenne Forschungslücken und führe Details in Textabschnitten aus.',
      es: 'Elabora revisiones académicas rigurosas con matrices comparativas concisas. Categoriza metodologías, cita fuentes [1], [2], identifica lagunas investigativas y detalla en secciones narrativas.',
      fr: 'Rédigez des revues académiques rigoureuses avec des tableaux comparatifs concis. Classez les méthodologies, citez [1], [2], identifiez les lacunes et détaillez dans les sections d’analyse.',
      it: 'Conduci rassegne accademiche accurate con matrici comparative sintetiche. Categorizza le metodologie, cita [1], [2], individua i gap e approfondisci nelle sezioni discorsive.',
      ja: '学術的で厳密な文献レビューを作成し、簡潔な比較マトリクス表、研究手法の分類、正確な引用 [1], [2]、リサーチギャップの明示を行ってください。',
      ko: '학술적으로 엄밀한 문헌 고찰을 제공하세요. 간결한 비교 매트릭스를 활용하고, 방법론 분류와 출처 인용 [1], [2] 및 연구 공백을 명확히 도출하세요.',
      pt: 'Produza revisões de literatura acadêmicas e rigorosas com matrizes comparativas concisas, categorizando metodologias, citando fontes [1], [2] e destacando lacunas.',
      ru: 'Создавайте академический обзор литературы с компактными таблицами синтеза, классификацией методологий, точным цитированием источников [1], [2] и фиксацией пробелов.',
      uk: 'Створюйте академічний огляд літератури з компактними таблицями синтезу, класифікацією методологій, точним цитуванням джерел [1], [2] та фіксацією прогалин.',
      zh: '撰写严谨规范的学术文献综述。运用紧凑清晰的对比矩阵表，归类研究方法，严谨标注引用 [1], [2]，精准提炼 Research Gaps 并展开论述。',
    },
  },
];

export function getLocalizedBuiltinTemplate(templateId: string, lang: string = 'en') {
  const normLang = (lang || 'en').toLowerCase().slice(0, 2);
  const found = BUILTIN_TEMPLATES.find((t) => t.id === templateId);
  if (!found) return null;

  return {
    id: found.id,
    name: found.name[normLang] || found.name['en'] || found.name['pl'],
    description: found.description[normLang] || found.description['en'] || found.description['pl'],
    icon: found.icon,
    content: found.content[normLang] || found.content['en'] || found.content['pl'],
    systemInstructions: found.systemInstructions[normLang] || found.systemInstructions['en'] || found.systemInstructions['pl'],
    isBuiltin: true,
  };
}
