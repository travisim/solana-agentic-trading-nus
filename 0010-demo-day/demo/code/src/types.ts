export type Lane = "agent" | "exchange" | "tooling";
export const LANES: readonly Lane[] = ["agent", "exchange", "tooling"];

export interface TestEvidence {
  command: string;
  passing: number;
  total: number;
}

export interface Project {
  id: string;
  name: string;
  lane: Lane;
  team: string[];
  summary: string;
  repo: string;
  demo?: string;
  devnetSignature?: string;
  programId?: string;
  tests?: TestEvidence;
  limitation: string;
  example?: boolean;
}

export interface ProjectsFile {
  event: string;
  template?: boolean;
  projects: Project[];
}

export interface Issue {
  id: string; // project id, or "(file)"
  field: string;
  message: string;
}

export interface Validation {
  ok: boolean;
  errors: Issue[];
  warnings: Issue[];
  counts: { projects: number; agent: number; exchange: number; tooling: number };
}

export type SigStatus = "finalized" | "confirmed" | "processed" | "not-found" | "failed";

export interface SigCheck {
  signature: string;
  cluster: "devnet";
  status: SigStatus;
  slot: number | null;
  err: unknown;
  checkedAt: string;
  mode: "recorded" | "live";
}

export interface NetworkInfo {
  cluster: "mainnet-beta";
  slot: number;
  capturedAt: string;
  slotsPerSecond: number | null;
  source: string;
  mode: "recorded" | "live";
}

export interface Evidence {
  tests: string;
  devnet: string;
  signatureCheck: SigCheck | null;
}

export interface GalleryProject extends Project {
  evidence: Evidence;
}

export interface Gallery {
  event: string;
  mode: "recorded" | "live";
  generatedAt: string;
  template: boolean;
  network: NetworkInfo;
  projects: GalleryProject[];
  byLane: Record<Lane, number>;
}
