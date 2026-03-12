export interface Fingerprint {
  id: number;
  website: string;
  url: string;
  risk_file: string;
  content: string;
  logic: string;
  ai_annotation: string;
  version: string;
  browser?: string;
  created_at: string;
}

export interface AnalysisItem {
  name: string;
  branches: string[];
  summary: string;
}

export interface Correction {
  id: number;
  fingerprint_id: number;
  item_key: string;
  correction: string;
}
