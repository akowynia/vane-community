export interface ResearchHypothesis {
  id: string;
  topic: string;
  angle: string;
  queries: string[];
  findingsCount: number;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface DeepResearchPlan {
  query: string;
  executiveFocus: string;
  hypotheses: ResearchHypothesis[];
}

export interface DeepResearchFinding {
  title: string;
  url: string;
  content: string;
  sourceCategory: string;
  publishedDate?: string;
  hopLevel: number;
}

export type DeepResearchStage =
  | 'planning'
  | 'exploring'
  | 'analyzing_gaps'
  | 'synthesizing'
  | 'completed';

export interface DeepResearchProgress {
  stage: DeepResearchStage;
  currentDepth: number;
  maxDepth: number;
  activeTopic?: string;
  discoveredSourcesCount: number;
  completedBranches: number;
  totalBranches: number;
}

export interface DeepResearchResult {
  whitepaper: string;
  sources: Array<{ title: string; url: string; publishedDate?: string }>;
  plan: DeepResearchPlan;
  totalSourcesExplored: number;
  durationMs: number;
}

