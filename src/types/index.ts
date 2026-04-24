/** Core sale record */
export type Sale = {
  id: string;
  date: string;
  clientName: string;
  clientEmail: string;
  product: string;
  closer: string;            // display name
  setter: string | null;     // display name (null when no setter)
  closerId: string;          // profiles.id
  setterId: string | null;   // profiles.id (null when no setter)
  amount: number;       // HT (ex-tax)
  amountTTC?: number;
  taxAmount?: number;
  closerCommission: number;
  setterCommission: number;
  bonus?: number;
  refunded?: boolean;
  impaye?: boolean;
  paymentType?: "pif" | "installments";
  numInstallments?: number;
  installmentAmount?: number;
  firstPaymentDate?: string;
  paymentPlatform?: string;
  callRecordingLink?: string;
  notes?: string;
  jotformSubmissionId?: string;
};

export type UserRole = "closer" | "setter" | "admin";

export type User = {
  id: string;
  name: string;
  role: UserRole;
};

export type Refund = {
  id: string;
  saleId: string;
  amount: number;
  date: string;
  status: "pending" | "approved" | "refused";
};

export type Impaye = {
  id: string;
  saleId: string;
  amount: number;
  date: string;
};

export type CallAnalysisStatus = "pending" | "synced" | "analyzing" | "done" | "error";

export type CallFeedback = {
  summary: string;
  strengths: string[];
  improvements: string[];
};

export type CallAnalysisDetails = {
  rapportScore: number;
  discoveryScore: number;
  pitchScore: number;
  objectionHandlingScore: number;
  closingScore: number;
  confidenceScore: number;
  nextStepClarityScore: number;
  dominantObjections: string[];
  buyerSignals: string[];
  coachTags: string[];
  missedOpportunities: string[];
  recommendedNextActions: string[];
};

export type CallAnalysis = {
  id: string;
  closerId: string;
  fathomMeetingId: string | null;
  callTitle: string | null;
  callDate: string | null;
  durationSeconds: number | null;
  transcript: string | null;
  score: number | null;
  feedback: CallFeedback | null;
  analysisDetails: CallAnalysisDetails | null;
  status: CallAnalysisStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CloserFramework = {
  id: string;
  closerId: string;
  framework: string;
  generatedFromCalls: string[];
  createdAt: string;
  updatedAt: string;
};

export type CloserProfile = {
  id: string;
  closerId: string;
  overview: string;
  strengths: string[];
  developmentPriorities: string[];
  commonObjections: string[];
  winningPatterns: string[];
  riskPatterns: string[];
  coachingTags: string[];
  averageScores: Record<string, number>;
  callsAnalyzed: number;
  lastCompiledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AssistantCitation = {
  callId: string;
  callTitle: string | null;
  callDate: string | null;
  reason: string;
};

export type AssistantThread = {
  id: string;
  closerId: string;
  title: string | null;
  isPinned: boolean;
  isArchived: boolean;
  shareId: string | null;
  createdBy: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AssistantMessage = {
  id: string;
  threadId: string;
  closerId: string;
  role: "user" | "assistant";
  content: string;
  citations: AssistantCitation[];
  contextSnapshot: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
};

export type AssistantMemorySnapshot = {
  id: string;
  closerId: string;
  summary: string;
  messageCountCovered: number;
  createdAt: string;
  updatedAt: string;
};

export type SalesAssistantResponse = {
  answer: string;
  citations: AssistantCitation[];
  threadId: string;
  messageId: string;
  contextMeta: {
    callsAnalyzed: number;
    selectedCallIncluded: boolean;
    frameworkIncluded: boolean;
    profileIncluded: boolean;
    memorySnapshotUsed: boolean;
  };
};

export type SetterIntegrationMapping = {
  profileId: string;
  setterName: string;
  aircallApiId: string | null;
  aircallApiToken: string | null;
  aircallUserId: string | null;
  aircallEmail: string | null;
  pipedriveOwnerId: string | null;
  pipedriveEmail: string | null;
  iclosedApiKey: string | null;
  iclosedApiBaseUrl: string | null;
  iclosedUserId: string | null;
  iclosedEmail: string | null;
  notes: string | null;
  updatedAt: string | null;
};

export type SetterCallMetricDaily = {
  profileId: string;
  metricDate: string;
  source: "aircall";
  callsMade: number;
  callsAnswered: number;
  talkTimeSeconds: number;
};

export type SetterFunnelMetricDaily = {
  profileId: string;
  metricDate: string;
  source: "pipedrive" | "iclosed";
  leadsValidated: number;
  leadsCanceled: number;
  showUps: number;
  closes: number;
};

export type SetterDashboardPoint = {
  date: string;
  callsMade: number;
  callsAnswered: number;
  talkTimeSeconds: number;
  leadsValidated: number;
  leadsCanceled: number;
  showUps: number;
  closes: number;
};

export type SetterDashboardSummary = {
  callsMade: number;
  callsAnswered: number;
  talkTimeSeconds: number;
  leadsValidated: number;
  leadsCanceled: number;
  showUps: number;
  closes: number;
  showRate: number;
  closeRate: number;
};

export type SetterDashboardMetrics = {
  summary: SetterDashboardSummary;
  points: SetterDashboardPoint[];
};

export type IntegrationSyncRun = {
  id: string;
  source: "aircall" | "pipedrive" | "iclosed" | "scheduler";
  mode: "manual" | "scheduled";
  status: "running" | "success" | "partial" | "error";
  syncedFrom: string | null;
  syncedTo: string | null;
  recordsSeen: number;
  rowsWritten: number;
  errors: string[];
  startedAt: string;
  finishedAt: string | null;
  triggeredBy: string | null;
};

export type GlobalSetting = {
  key: string;
  value: string | null;
  description: string | null;
  isSecret: boolean;
  updatedAt: string;
};
