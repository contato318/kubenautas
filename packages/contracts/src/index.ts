export type AuthProvider = 'google' | 'github';
export { safeReturnPath } from './auth-redirect';

export interface User {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  provider: AuthProvider;
  welcomeCompleted: boolean;
  isAdmin: boolean;
}

export interface SessionResponse {
  user: User | null;
  providers: Record<AuthProvider, boolean>;
}

export interface Progress {
  quizzes: Record<string, number>;
  completed: Record<string, string>;
  examBest?: number;
  cases?: Record<string, { at: string; correct: boolean }>;
}

export interface QuizResult { lessonKey: string; score: number; eventId?: string }
export interface ExamResult { score: number; eventId?: string }
export interface CaseResult { slug: string; correct: boolean; eventId?: string }

export interface Certificate {
  id: string;
  fullName: string;
  examScore: number;
  issuedAt: string;
  verificationUrl: string;
}

export interface IssueCertificate { fullName: string }
export interface CertificateResponse { certificate: Certificate | null }

export { learningCatalog } from './learning-catalog';
export type VisitKind = 'lesson_opened' | 'simulator_opened' | 'case_opened' | 'exam_started';
export type ActivityKind = VisitKind | 'quiz_submitted' | 'exam_submitted' | 'case_answered' | 'certificate_issued' | 'progress_reset';
export interface ActivityVisit { kind: VisitKind; target: string; eventId: string }
export interface UserActivity { id: string; kind: ActivityKind; target: string | null; score: number | null; correct: boolean | null; occurredAt: string }
export type AdminStage = 'all' | 'not_started' | 'started' | 'completed' | 'certified';
export interface AdminOverview {
  registered: number; started: number; completed: number; certified: number; examPassed: number;
  totalLessons: number; trackingSince: string;
  registrations: { date: string; count: number }[];
}
export interface AdminUserSummary {
  id: string; name: string; email: string | null; provider: AuthProvider;
  createdAt: string; lastLoginAt: string | null; lastActivityAt: string | null;
  welcomeCompleted: boolean; started: boolean; completed: boolean;
  completedLessons: number; attemptedLessons: number; answeredCases: number; examBest: number | null;
  certificateId: string | null; certificateIssuedAt: string | null;
}
export interface AdminUsersResponse { users: AdminUserSummary[]; total: number; page: number; pageSize: number; totalLessons: number }
export interface AdminUserDetail {
  user: AdminUserSummary; progress: Progress; certificate: Certificate | null;
  trackingSince: string; totalLessons: number;
  visits: { lessons: number; simulators: number; cases: number };
}
export interface AdminActivityResponse { events: UserActivity[]; total: number; page: number; pageSize: number }
