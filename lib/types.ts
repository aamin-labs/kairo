export type Rating = "again" | "hard" | "good" | "easy";

export type ImportedCard = {
  question: string;
  answer: string;
  context: string;
  explanation: string;
  noteId?: string;
};

export type ReviewMemory = {
  learningEdge: string;
  evidence: string;
  updatedAt: string;
};

export type ReviewMemoryProposal = Omit<ReviewMemory, "updatedAt">;

export type ReviewCard = ImportedCard & {
  id: string;
  intervalDays: number;
  dueAt: string;
  seen: boolean;
  noteId?: string;
  buriedUntil?: string;
  suspended?: boolean;
  reviewMemory?: ReviewMemory;
  lastAttempt?: {
    answer: string;
    feedback: Feedback;
    coachingThread: CoachingMessage[];
    rating: Rating;
    reviewedAt: string;
  };
};

export type Feedback = {
  text: string;
  followUpPrompt?: string;
  reviewMemory?: ReviewMemoryProposal | null;
};

export type Hint = {
  hint: string;
};

export type CoachingRole = "learner" | "coach";

export type CoachingMessage = {
  role: CoachingRole;
  text: string;
};

export type CoachingResponse = {
  text: string;
  followUpPrompt?: string;
  reviewMemory?: ReviewMemoryProposal | null;
};
