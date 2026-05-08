export type Rating = "again" | "hard" | "good" | "easy";

export type ImportedCard = {
  question: string;
  answer: string;
  context: string;
  explanation: string;
};

export type ReviewCard = ImportedCard & {
  id: string;
  intervalDays: number;
  dueAt: string;
  seen: boolean;
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
};
