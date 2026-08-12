export type Role = "owner" | "admin" | "member";
export type ProblemStatus = "todo" | "in_progress" | "done";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface Study {
  id: string;
  name: string;
  description: string;
  inviteCode: string;
  color: string;
  createdBy: string;
  createdAt: string;
  role: Role;
  memberCount: number;
  githubRepoUrl?: string;
  githubBranch?: string;
  githubRootPath?: string;
  githubSyncedAt?: string;
  githubAutoApproveClaims?: boolean;
}

export interface StudyMember {
  id: string;
  studyId: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  joinedAt: string;
}

export interface Week {
  id: string;
  studyId: string;
  weekNumber: number;
  title: string;
  description: string;
  dueDate: string;
  createdAt: string;
}

export interface Problem {
  id: string;
  weekId: string;
  title: string;
  url: string;
  platform: string;
  difficulty: string;
  required: boolean;
  createdAt: string;
  sourceKey?: string;
}

export interface GitHubSolution {
  id: string;
  problemId: string;
  authorLabel: string;
  language: string;
  code: string;
  filePath: string;
  htmlUrl: string;
  blobSha: string;
  syncedAt: string;
  claimedBy?: string;
  claimStatus?: "pending" | "approved" | "rejected";
  claimRequestedBy?: string;
  claimReviewedBy?: string;
  claimRequestedAt?: string;
  claimReviewedAt?: string;
}

export interface GitHubSolutionComment {
  id: string;
  githubSolutionId: string;
  userId: string;
  userName: string;
  body: string;
  kind: "feedback" | "question";
  createdAt: string;
}

export interface GitHubImportEntry {
  weekNumber: number;
  problemKey: string;
  problemTitle: string;
  problemUrl: string;
  authorLabel: string;
  language: string;
  code: string;
  filePath: string;
  htmlUrl: string;
  blobSha: string;
}

export interface Submission {
  id: string;
  problemId: string;
  userId: string;
  userName: string;
  language: string;
  code: string;
  explanation: string;
  complexity: string;
  status: ProblemStatus;
  updatedAt: string;
}

export interface Comment {
  id: string;
  submissionId: string;
  userId: string;
  userName: string;
  body: string;
  kind: "feedback" | "question";
  createdAt: string;
}

export interface StudyState {
  studies: Study[];
  members: StudyMember[];
  weeks: Week[];
  problems: Problem[];
  submissions: Submission[];
  comments: Comment[];
  githubSolutions: GitHubSolution[];
  githubComments: GitHubSolutionComment[];
}
