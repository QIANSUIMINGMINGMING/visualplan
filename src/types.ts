export const objectKinds = [
  "node",
  "region",
  "boundary",
  "evidence",
  "uncertainty",
] as const;

export const relationKinds = [
  "flow",
  "contain",
  "depend",
  "conflict",
  "forbid",
  "map",
  "feedback",
  "order",
] as const;

export const alignmentModes = [
  "plan",
  "goal",
  "session",
  "architecture",
  "research",
  "custom",
] as const;

export type ObjectKind = (typeof objectKinds)[number];
export type RelationKind = (typeof relationKinds)[number];
export type AlignmentMode = (typeof alignmentModes)[number];

export interface VisualPlanSource {
  agent?: string;
  surface?: string;
  prompt?: string;
  goal?: string;
}

export interface VisualObject {
  id: string;
  kind: ObjectKind;
  label: string;
  summary?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface VisualRelation {
  id: string;
  type: RelationKind;
  from: string;
  to: string;
  label?: string;
  summary?: string;
  evidence?: string;
}

export interface SpaceSemantics {
  x_axis: string;
  y_axis: string;
  containment: string;
  proximity: string;
}

export interface Focus {
  primary_path: string[];
  key_boundaries: string[];
  unresolved: string[];
  accepted: string[];
}

export interface Uncertainty {
  id: string;
  target: string;
  question: string;
  impact?: string;
  status?: "open" | "accepted" | "resolved";
}

export interface RevisionNote {
  id: string;
  date: string;
  source: string;
  note: string;
  changed_objects: string[];
  changed_relations: string[];
}

export interface VisualPlan {
  mode?: AlignmentMode;
  source?: VisualPlanSource;
  title: string;
  intent: string;
  objects: VisualObject[];
  relations: VisualRelation[];
  space: SpaceSemantics;
  focus: Focus;
  uncertainties: Uncertainty[];
  revisions: RevisionNote[];
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface RenderOptions {
  generatedAt?: Date;
}

export interface OutputPaths {
  primaryPath: string;
  markdownPath: string;
  svgPath: string;
}
