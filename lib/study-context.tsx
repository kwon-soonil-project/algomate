"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { demoState } from "./demo-data";
import { makeSampleGitHubEntries } from "./github-import";
import { useAuth } from "./auth-context";
import { getSupabaseBrowserClient } from "./supabase";
import type { Comment, GitHubImportEntry, GitHubSolution, GitHubSolutionComment, Problem, ProblemStatus, Study, StudyMember, StudyState, Submission, Week } from "./types";
import { makeInviteCode, platformFromUrl } from "./utils";

interface CreateStudyInput { name: string; description: string; color: string }
interface CreateWeekInput { studyId: string; title: string; description: string; dueDate: string }
interface CreateProblemInput { weekId: string; title: string; url: string; difficulty: string; required: boolean }
interface SaveSubmissionInput { problemId: string; language: string; code: string; explanation: string; complexity: string; status: ProblemStatus }
interface SyncGitHubInput { studyId: string; repoUrl: string; branch: string; rootPath: string; sample?: boolean }
interface SyncGitHubResult { weeks: number; problems: number; solutions: number }

interface StudyContextValue extends StudyState {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createStudy: (input: CreateStudyInput) => Promise<Study>;
  joinStudy: (code: string) => Promise<Study>;
  createWeek: (input: CreateWeekInput) => Promise<Week>;
  createProblem: (input: CreateProblemInput) => Promise<Problem>;
  deleteProblem: (problemId: string) => Promise<void>;
  removeMember: (studyId: string, memberId: string) => Promise<void>;
  transferOwnership: (studyId: string, newOwnerUserId: string) => Promise<void>;
  deleteStudy: (studyId: string) => Promise<void>;
  saveSubmission: (input: SaveSubmissionInput) => Promise<Submission>;
  addComment: (submissionId: string, body: string, kind: Comment["kind"]) => Promise<Comment>;
  addGitHubComment: (solutionId: string, body: string, kind: GitHubSolutionComment["kind"]) => Promise<GitHubSolutionComment>;
  requestGitHubClaim: (solutionId: string) => Promise<"pending" | "approved">;
  reviewGitHubClaims: (solutionIds: string[], approve: boolean) => Promise<void>;
  setGitHubAutoApprove: (studyId: string, enabled: boolean) => Promise<void>;
  syncGitHub: (input: SyncGitHubInput) => Promise<SyncGitHubResult>;
}

const StudyContext = createContext<StudyContextValue | null>(null);
const DEMO_STATE_KEY = "algomate-demo-state-v1";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function readDemoState(): StudyState {
  try {
    const stored = window.localStorage.getItem(DEMO_STATE_KEY);
    const parsed = stored ? JSON.parse(stored) : structuredClone(demoState);
    return { ...parsed, githubSolutions: parsed.githubSolutions ?? [], githubComments: parsed.githubComments ?? [] };
  } catch {
    return structuredClone(demoState);
  }
}

function persistDemoState(state: StudyState) {
  window.localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(state));
}

function stateWithoutProblem(current: StudyState, problemId: string): StudyState {
  const submissionIds = new Set(current.submissions.filter((item) => item.problemId === problemId).map((item) => item.id));
  const githubSolutionIds = new Set(current.githubSolutions.filter((item) => item.problemId === problemId).map((item) => item.id));
  return {
    ...current,
    problems: current.problems.filter((item) => item.id !== problemId),
    submissions: current.submissions.filter((item) => item.problemId !== problemId),
    comments: current.comments.filter((item) => !submissionIds.has(item.submissionId)),
    githubSolutions: current.githubSolutions.filter((item) => item.problemId !== problemId),
    githubComments: current.githubComments.filter((item) => !githubSolutionIds.has(item.githubSolutionId)),
  };
}

function stateWithoutStudy(current: StudyState, studyId: string): StudyState {
  const weekIds = new Set(current.weeks.filter((item) => item.studyId === studyId).map((item) => item.id));
  const problemIds = new Set(current.problems.filter((item) => weekIds.has(item.weekId)).map((item) => item.id));
  const submissionIds = new Set(current.submissions.filter((item) => problemIds.has(item.problemId)).map((item) => item.id));
  const githubSolutionIds = new Set(current.githubSolutions.filter((item) => problemIds.has(item.problemId)).map((item) => item.id));
  return {
    studies: current.studies.filter((item) => item.id !== studyId),
    members: current.members.filter((item) => item.studyId !== studyId),
    weeks: current.weeks.filter((item) => item.studyId !== studyId),
    problems: current.problems.filter((item) => !problemIds.has(item.id)),
    submissions: current.submissions.filter((item) => !problemIds.has(item.problemId)),
    comments: current.comments.filter((item) => !submissionIds.has(item.submissionId)),
    githubSolutions: current.githubSolutions.filter((item) => !problemIds.has(item.problemId)),
    githubComments: current.githubComments.filter((item) => !githubSolutionIds.has(item.githubSolutionId)),
  };
}

function isMissingManagementFunction(error: { code?: string; message?: string }) {
  return error.code === "PGRST202" || error.message?.includes("schema cache") === true;
}

function githubFeatureError(error: { code?: string; message?: string }) {
  if (isMissingManagementFunction(error) || error.code === "PGRST205" || error.code === "42P01") {
    return new Error("Supabase에 GitHub 소유권·피드백 마이그레이션을 먼저 적용해 주세요.");
  }
  return new Error(error.message || "GitHub 풀이 정보를 변경하지 못했습니다.");
}

export function StudyProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, isDemo } = useAuth();
  const [state, setState] = useState<StudyState>({ studies: [], members: [], weeks: [], problems: [], submissions: [], comments: [], githubSolutions: [], githubComments: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const userId = user?.id ?? null;
  const loadedUserIdRef = useRef<string | null>(null);

  const loadRemoteState = useCallback(async () => {
    if (!supabase || !userId) return;
    setError(null);
    const { data: memberships, error: membershipError } = await supabase
      .from("study_members")
      .select("role, studies(*)")
      .eq("user_id", userId);
    if (membershipError) throw membershipError;

    const studies = (memberships ?? []).flatMap((row: any) => {
      const item = Array.isArray(row.studies) ? row.studies[0] : row.studies;
      return item ? [{
        id: item.id,
        name: item.name,
        description: item.description ?? "",
        inviteCode: item.invite_code,
        color: item.color,
        createdBy: item.created_by,
        createdAt: item.created_at,
        role: row.role,
        memberCount: 0,
        githubRepoUrl: item.github_repo_url ?? undefined,
        githubBranch: item.github_branch ?? undefined,
        githubRootPath: item.github_root_path ?? undefined,
        githubSyncedAt: item.github_synced_at ?? undefined,
        githubAutoApproveClaims: item.github_auto_approve_claims ?? false,
      } as Study] : [];
    });

    if (!studies.length) {
      setState({ studies: [], members: [], weeks: [], problems: [], submissions: [], comments: [], githubSolutions: [], githubComments: [] });
      return;
    }

    const studyIds = studies.map((study) => study.id);
    const [membersResult, weeksResult] = await Promise.all([
      supabase.from("study_members").select("id, study_id, user_id, role, joined_at, profiles(name, email)").in("study_id", studyIds),
      supabase.from("study_weeks").select("*").in("study_id", studyIds).order("week_number"),
    ]);
    if (membersResult.error) throw membersResult.error;
    if (weeksResult.error) throw weeksResult.error;

    const members: StudyMember[] = (membersResult.data ?? []).map((row: any) => ({
      id: row.id,
      studyId: row.study_id,
      userId: row.user_id,
      name: row.profiles?.name ?? "스터디원",
      email: row.profiles?.email ?? "",
      role: row.role,
      joinedAt: row.joined_at,
    }));
    studies.forEach((study) => { study.memberCount = members.filter((member) => member.studyId === study.id).length; });

    const weeks: Week[] = (weeksResult.data ?? []).map((row: any) => ({
      id: row.id, studyId: row.study_id, weekNumber: row.week_number, title: row.title,
      description: row.description ?? "", dueDate: row.due_date, createdAt: row.created_at,
    }));
    const weekIds = weeks.map((week) => week.id);
    const problemsResult = weekIds.length
      ? await supabase.from("problems").select("*").in("week_id", weekIds).order("created_at")
      : { data: [], error: null };
    if (problemsResult.error) throw problemsResult.error;
    const problems: Problem[] = (problemsResult.data ?? []).map((row: any) => ({
      id: row.id, weekId: row.week_id, title: row.title, url: row.url, platform: row.platform,
      difficulty: row.difficulty ?? "", required: row.required, createdAt: row.created_at, sourceKey: row.source_key ?? undefined,
    }));

    const problemIds = problems.map((problem) => problem.id);
    const submissionsResult = problemIds.length
      ? await supabase.from("submissions").select("*, profiles(name)").in("problem_id", problemIds)
      : { data: [], error: null };
    if (submissionsResult.error) throw submissionsResult.error;
    const submissions: Submission[] = (submissionsResult.data ?? []).map((row: any) => ({
      id: row.id, problemId: row.problem_id, userId: row.user_id, userName: row.profiles?.name ?? "스터디원",
      language: row.language, code: row.code, explanation: row.explanation ?? "", complexity: row.complexity ?? "",
      status: row.status, updatedAt: row.updated_at,
    }));

    const submissionIds = submissions.map((submission) => submission.id);
    const [commentsResult, githubResult] = await Promise.all([
      submissionIds.length
        ? supabase.from("comments").select("*, profiles(name)").in("submission_id", submissionIds).order("created_at")
        : Promise.resolve({ data: [], error: null }),
      problemIds.length
        ? supabase.from("github_solutions").select("*").in("problem_id", problemIds).order("file_path")
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (commentsResult.error) throw commentsResult.error;
    if (githubResult.error) throw githubResult.error;
    const comments: Comment[] = (commentsResult.data ?? []).map((row: any) => ({
      id: row.id, submissionId: row.submission_id, userId: row.user_id, userName: row.profiles?.name ?? "스터디원",
      body: row.body, kind: row.kind, createdAt: row.created_at,
    }));
    const githubSolutions: GitHubSolution[] = (githubResult.data ?? []).map((row: any) => ({
      id: row.id, problemId: row.problem_id, authorLabel: row.author_label, language: row.language,
      code: row.code, filePath: row.file_path, htmlUrl: row.html_url, blobSha: row.blob_sha, syncedAt: row.synced_at,
      claimedBy: row.claimed_by ?? undefined, claimStatus: row.claim_status ?? undefined,
      claimRequestedBy: row.claim_requested_by ?? undefined, claimReviewedBy: row.claim_reviewed_by ?? undefined,
      claimRequestedAt: row.claim_requested_at ?? undefined, claimReviewedAt: row.claim_reviewed_at ?? undefined,
    }));
    const githubSolutionIds = githubSolutions.map((solution) => solution.id);
    const githubCommentsResult = githubSolutionIds.length
      ? await supabase.from("github_solution_comments").select("*, profiles(name)").in("github_solution_id", githubSolutionIds).order("created_at")
      : { data: [], error: null };
    const missingCommentsTable = githubCommentsResult.error?.code === "PGRST205" || githubCommentsResult.error?.code === "42P01";
    if (githubCommentsResult.error && !missingCommentsTable) throw githubCommentsResult.error;
    const githubComments: GitHubSolutionComment[] = (githubCommentsResult.data ?? []).map((row: any) => ({
      id: row.id, githubSolutionId: row.github_solution_id, userId: row.user_id, userName: row.profiles?.name ?? "스터디원",
      body: row.body, kind: row.kind, createdAt: row.created_at,
    }));
    setState({ studies, members, weeks, problems, submissions, comments, githubSolutions, githubComments });
  }, [supabase, userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      if (isDemo) setState(readDemoState());
      else await loadRemoteState();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [isDemo, loadRemoteState, userId]);

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      loadedUserIdRef.current = null;
      setState({ studies: [], members: [], weeks: [], problems: [], submissions: [], comments: [], githubSolutions: [], githubComments: [] });
      setLoading(false);
      return;
    }
    if (loadedUserIdRef.current === userId) return;
    loadedUserIdRef.current = userId;
    setLoading(true);
    void refresh();
  }, [authLoading, refresh, userId]);

  useEffect(() => {
    if (!supabase || !userId) return;
    const channel = supabase
      .channel(`algomate-live-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions" }, () => void loadRemoteState())
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, () => void loadRemoteState())
      .on("postgres_changes", { event: "*", schema: "public", table: "github_solutions" }, () => void loadRemoteState())
      .on("postgres_changes", { event: "*", schema: "public", table: "github_solution_comments" }, () => void loadRemoteState())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadRemoteState, supabase, userId]);

  const updateDemo = useCallback(<T,>(mutate: (current: StudyState) => [StudyState, T]) => {
    const current = readDemoState();
    const [next, result] = mutate(current);
    persistDemoState(next);
    setState(next);
    return result;
  }, []);

  const createStudy = useCallback(async (input: CreateStudyInput) => {
    if (!user) throw new Error("로그인이 필요합니다.");
    if (isDemo) return updateDemo((current) => {
      const study: Study = { id: uid("study"), ...input, inviteCode: makeInviteCode(), createdBy: user.id, createdAt: new Date().toISOString(), role: "owner", memberCount: 1 };
      const member: StudyMember = { id: uid("member"), studyId: study.id, userId: user.id, name: user.name, email: user.email, role: "owner", joinedAt: new Date().toISOString() };
      return [{ ...current, studies: [...current.studies, study], members: [...current.members, member] }, study];
    });
    const { data, error: rpcError } = await supabase!.rpc("create_study_with_owner", { p_name: input.name, p_description: input.description, p_color: input.color });
    if (rpcError) throw rpcError;
    await loadRemoteState();
    return { id: data, ...input, inviteCode: "", createdBy: user.id, createdAt: new Date().toISOString(), role: "owner" as const, memberCount: 1 };
  }, [isDemo, loadRemoteState, supabase, updateDemo, user]);

  const joinStudy = useCallback(async (code: string) => {
    if (!user) throw new Error("로그인이 필요합니다.");
    const normalized = code.trim().toUpperCase();
    if (isDemo) return updateDemo((current) => {
      const study = current.studies.find((item) => item.inviteCode === normalized);
      if (!study) throw new Error("유효하지 않은 초대 코드입니다.");
      if (current.members.some((member) => member.studyId === study.id && member.userId === user.id)) return [current, study];
      const member: StudyMember = { id: uid("member"), studyId: study.id, userId: user.id, name: user.name, email: user.email, role: "member", joinedAt: new Date().toISOString() };
      const studies = current.studies.map((item) => item.id === study.id ? { ...item, memberCount: item.memberCount + 1, role: "member" as const } : item);
      return [{ ...current, studies, members: [...current.members, member] }, { ...study, memberCount: study.memberCount + 1, role: "member" as const }];
    });
    const { data, error: rpcError } = await supabase!.rpc("join_study_by_code", { p_code: normalized });
    if (rpcError) throw rpcError;
    await loadRemoteState();
    const study = state.studies.find((item) => item.id === data);
    return study ?? { id: data, name: "새 스터디", description: "", inviteCode: normalized, color: "violet", createdBy: "", createdAt: new Date().toISOString(), role: "member", memberCount: 1 };
  }, [isDemo, loadRemoteState, state.studies, supabase, updateDemo, user]);

  const createWeek = useCallback(async (input: CreateWeekInput) => {
    if (!user) throw new Error("로그인이 필요합니다.");
    const existing = state.weeks.filter((week) => week.studyId === input.studyId);
    const weekNumber = Math.max(0, ...existing.map((week) => week.weekNumber)) + 1;
    if (isDemo) return updateDemo((current) => {
      const week: Week = { id: uid("week"), ...input, weekNumber, dueDate: new Date(input.dueDate).toISOString(), createdAt: new Date().toISOString() };
      return [{ ...current, weeks: [...current.weeks, week] }, week];
    });
    const { data, error: insertError } = await supabase!.from("study_weeks").insert({ study_id: input.studyId, week_number: weekNumber, title: input.title, description: input.description, due_date: input.dueDate }).select().single();
    if (insertError) throw insertError;
    const week: Week = { id: data.id, studyId: data.study_id, weekNumber: data.week_number, title: data.title, description: data.description ?? "", dueDate: data.due_date, createdAt: data.created_at };
    setState((current) => ({ ...current, weeks: [...current.weeks, week] }));
    return week;
  }, [isDemo, state.weeks, supabase, updateDemo, user]);

  const createProblem = useCallback(async (input: CreateProblemInput) => {
    if (!user) throw new Error("로그인이 필요합니다.");
    const platform = platformFromUrl(input.url);
    if (isDemo) return updateDemo((current) => {
      const problem: Problem = { id: uid("problem"), ...input, platform, createdAt: new Date().toISOString() };
      return [{ ...current, problems: [...current.problems, problem] }, problem];
    });
    const { data, error: insertError } = await supabase!.from("problems").insert({ week_id: input.weekId, title: input.title, url: input.url, platform, difficulty: input.difficulty, required: input.required }).select().single();
    if (insertError) throw insertError;
    const problem: Problem = { id: data.id, weekId: data.week_id, title: data.title, url: data.url, platform: data.platform, difficulty: data.difficulty ?? "", required: data.required, createdAt: data.created_at };
    setState((current) => ({ ...current, problems: [...current.problems, problem] }));
    return problem;
  }, [isDemo, supabase, updateDemo, user]);

  const deleteProblem = useCallback(async (problemId: string) => {
    if (!user) throw new Error("로그인이 필요합니다.");
    const problem = state.problems.find((item) => item.id === problemId);
    const week = problem ? state.weeks.find((item) => item.id === problem.weekId) : undefined;
    const study = week ? state.studies.find((item) => item.id === week.studyId) : undefined;
    if (!problem || !study) throw new Error("문제를 찾을 수 없습니다.");
    if (study.role === "member") throw new Error("방장 또는 운영진만 문제를 삭제할 수 있습니다.");

    if (isDemo) {
      updateDemo((current) => [stateWithoutProblem(current, problemId), undefined]);
      return;
    }
    const { error: deleteError } = await supabase!.from("problems").delete().eq("id", problemId);
    if (deleteError) throw deleteError;
    setState((current) => stateWithoutProblem(current, problemId));
  }, [isDemo, state.problems, state.studies, state.weeks, supabase, updateDemo, user]);

  const removeMember = useCallback(async (studyId: string, memberId: string) => {
    if (!user) throw new Error("로그인이 필요합니다.");
    const study = state.studies.find((item) => item.id === studyId);
    const target = state.members.find((item) => item.id === memberId && item.studyId === studyId);
    if (!study || !target) throw new Error("팀원을 찾을 수 없습니다.");
    if (target.userId === user.id) throw new Error("자기 자신은 강퇴할 수 없습니다.");
    if (target.role === "owner") throw new Error("방장은 강퇴할 수 없습니다.");
    if (study.role === "member" || (study.role === "admin" && target.role !== "member")) throw new Error("해당 팀원을 강퇴할 권한이 없습니다.");

    if (isDemo) {
      updateDemo((current) => [{
        ...current,
        studies: current.studies.map((item) => item.id === studyId ? { ...item, memberCount: Math.max(1, item.memberCount - 1) } : item),
        members: current.members.filter((item) => item.id !== memberId),
      }, undefined]);
      return;
    }

    const { error: rpcError } = await supabase!.rpc("remove_study_member", { p_study_id: studyId, p_member_id: memberId });
    if (rpcError && !isMissingManagementFunction(rpcError)) throw rpcError;
    if (rpcError) {
      const { error: deleteError } = await supabase!.from("study_members").delete().eq("id", memberId).eq("study_id", studyId);
      if (deleteError) throw deleteError;
    }
    await loadRemoteState();
  }, [isDemo, loadRemoteState, state.members, state.studies, supabase, updateDemo, user]);

  const transferOwnership = useCallback(async (studyId: string, newOwnerUserId: string) => {
    if (!user) throw new Error("로그인이 필요합니다.");
    const study = state.studies.find((item) => item.id === studyId);
    const target = state.members.find((item) => item.studyId === studyId && item.userId === newOwnerUserId);
    const currentMember = state.members.find((item) => item.studyId === studyId && item.userId === user.id);
    if (!study || study.role !== "owner") throw new Error("방장만 방장을 위임할 수 있습니다.");
    if (!target || target.userId === user.id) throw new Error("위임할 팀원을 확인해 주세요.");
    if (!currentMember) throw new Error("현재 방장 정보를 찾을 수 없습니다.");

    if (isDemo) {
      updateDemo((current) => [{
        ...current,
        studies: current.studies.map((item) => item.id === studyId ? { ...item, createdBy: target.userId, role: "admin" as const } : item),
        members: current.members.map((item) => item.studyId !== studyId ? item : item.userId === target.userId ? { ...item, role: "owner" as const } : item.userId === user.id ? { ...item, role: "admin" as const } : item),
      }, undefined]);
      return;
    }

    const { error: rpcError } = await supabase!.rpc("transfer_study_owner", { p_study_id: studyId, p_new_owner_id: target.userId });
    if (rpcError && !isMissingManagementFunction(rpcError)) throw rpcError;
    if (rpcError) {
      const previousTargetRole = target.role;
      const { error: promoteError } = await supabase!.from("study_members").update({ role: "owner" }).eq("id", target.id).eq("study_id", studyId);
      if (promoteError) throw promoteError;
      const { error: studyError } = await supabase!.from("studies").update({ created_by: target.userId }).eq("id", studyId);
      if (studyError) {
        await supabase!.from("study_members").update({ role: previousTargetRole }).eq("id", target.id);
        throw studyError;
      }
      const { error: demoteError } = await supabase!.from("study_members").update({ role: "admin" }).eq("id", currentMember.id).eq("study_id", studyId);
      if (demoteError) {
        await supabase!.from("studies").update({ created_by: user.id }).eq("id", studyId);
        await supabase!.from("study_members").update({ role: previousTargetRole }).eq("id", target.id);
        throw demoteError;
      }
    }
    await loadRemoteState();
  }, [isDemo, loadRemoteState, state.members, state.studies, supabase, updateDemo, user]);

  const deleteStudy = useCallback(async (studyId: string) => {
    if (!user) throw new Error("로그인이 필요합니다.");
    const study = state.studies.find((item) => item.id === studyId);
    if (!study || study.role !== "owner") throw new Error("방장만 스터디를 삭제할 수 있습니다.");

    if (isDemo) {
      updateDemo((current) => [stateWithoutStudy(current, studyId), undefined]);
      return;
    }
    const { error: rpcError } = await supabase!.rpc("delete_owned_study", { p_study_id: studyId });
    if (rpcError && !isMissingManagementFunction(rpcError)) throw rpcError;
    if (rpcError) {
      const { error: deleteError } = await supabase!.from("studies").delete().eq("id", studyId);
      if (deleteError) throw deleteError;
    }
    setState((current) => stateWithoutStudy(current, studyId));
  }, [isDemo, state.studies, supabase, updateDemo, user]);

  const saveSubmission = useCallback(async (input: SaveSubmissionInput) => {
    if (!user) throw new Error("로그인이 필요합니다.");
    if (isDemo) return updateDemo((current) => {
      const found = current.submissions.find((item) => item.problemId === input.problemId && item.userId === user.id);
      const submission: Submission = { id: found?.id ?? uid("submission"), ...input, userId: user.id, userName: user.name, updatedAt: new Date().toISOString() };
      const submissions = found ? current.submissions.map((item) => item.id === found.id ? submission : item) : [...current.submissions, submission];
      return [{ ...current, submissions }, submission];
    });
    const { data, error: upsertError } = await supabase!.from("submissions").upsert({ problem_id: input.problemId, user_id: user.id, language: input.language, code: input.code, explanation: input.explanation, complexity: input.complexity, status: input.status }, { onConflict: "problem_id,user_id" }).select().single();
    if (upsertError) throw upsertError;
    const submission: Submission = { id: data.id, problemId: data.problem_id, userId: data.user_id, userName: user.name, language: data.language, code: data.code, explanation: data.explanation ?? "", complexity: data.complexity ?? "", status: data.status, updatedAt: data.updated_at };
    setState((current) => ({ ...current, submissions: [...current.submissions.filter((item) => !(item.problemId === input.problemId && item.userId === user.id)), submission] }));
    return submission;
  }, [isDemo, supabase, updateDemo, user]);

  const addComment = useCallback(async (submissionId: string, body: string, kind: Comment["kind"]) => {
    if (!user) throw new Error("로그인이 필요합니다.");
    if (isDemo) return updateDemo((current) => {
      const comment: Comment = { id: uid("comment"), submissionId, userId: user.id, userName: user.name, body, kind, createdAt: new Date().toISOString() };
      return [{ ...current, comments: [...current.comments, comment] }, comment];
    });
    const { data, error: insertError } = await supabase!.from("comments").insert({ submission_id: submissionId, user_id: user.id, body, kind }).select().single();
    if (insertError) throw insertError;
    const comment: Comment = { id: data.id, submissionId: data.submission_id, userId: data.user_id, userName: user.name, body: data.body, kind: data.kind, createdAt: data.created_at };
    setState((current) => ({ ...current, comments: [...current.comments, comment] }));
    return comment;
  }, [isDemo, supabase, updateDemo, user]);

  const addGitHubComment = useCallback(async (solutionId: string, body: string, kind: GitHubSolutionComment["kind"]) => {
    if (!user) throw new Error("로그인이 필요합니다.");
    if (!body.trim()) throw new Error("댓글 내용을 입력해 주세요.");
    if (isDemo) return updateDemo((current) => {
      if (!current.githubSolutions.some((item) => item.id === solutionId)) throw new Error("GitHub 풀이를 찾을 수 없습니다.");
      const comment: GitHubSolutionComment = {
        id: uid("github-comment"), githubSolutionId: solutionId, userId: user.id, userName: user.name,
        body: body.trim(), kind, createdAt: new Date().toISOString(),
      };
      return [{ ...current, githubComments: [...current.githubComments, comment] }, comment];
    });
    const { data, error: insertError } = await supabase!.from("github_solution_comments").insert({
      github_solution_id: solutionId, user_id: user.id, body: body.trim(), kind,
    }).select().single();
    if (insertError) throw githubFeatureError(insertError);
    const comment: GitHubSolutionComment = {
      id: data.id, githubSolutionId: data.github_solution_id, userId: data.user_id, userName: user.name,
      body: data.body, kind: data.kind, createdAt: data.created_at,
    };
    setState((current) => ({ ...current, githubComments: [...current.githubComments, comment] }));
    return comment;
  }, [isDemo, supabase, updateDemo, user]);

  const requestGitHubClaim = useCallback(async (solutionId: string) => {
    if (!user) throw new Error("로그인이 필요합니다.");
    if (isDemo) return updateDemo((current) => {
      const solution = current.githubSolutions.find((item) => item.id === solutionId);
      const problem = solution ? current.problems.find((item) => item.id === solution.problemId) : undefined;
      const week = problem ? current.weeks.find((item) => item.id === problem.weekId) : undefined;
      const study = week ? current.studies.find((item) => item.id === week.studyId) : undefined;
      if (!solution || !study) throw new Error("GitHub 풀이를 찾을 수 없습니다.");
      if (solution.claimStatus === "approved" && solution.claimedBy !== user.id) throw new Error("이미 다른 팀원의 풀이로 승인되었습니다.");
      if (solution.claimStatus === "pending" && solution.claimRequestedBy !== user.id) throw new Error("다른 팀원의 승인 요청이 대기 중입니다.");
      const status = study.githubAutoApproveClaims ? "approved" as const : "pending" as const;
      const now = new Date().toISOString();
      const githubSolutions = current.githubSolutions.map((item) => item.id === solutionId ? {
        ...item, claimStatus: status, claimRequestedBy: user.id, claimRequestedAt: now,
        claimedBy: status === "approved" ? user.id : undefined,
        claimReviewedBy: status === "approved" ? user.id : undefined,
        claimReviewedAt: status === "approved" ? now : undefined,
      } : item);
      return [{ ...current, githubSolutions }, status];
    });
    const { data, error: rpcError } = await supabase!.rpc("request_github_solution_claim", { p_solution_id: solutionId });
    if (rpcError) throw githubFeatureError(rpcError);
    await loadRemoteState();
    return data === "approved" ? "approved" as const : "pending" as const;
  }, [isDemo, loadRemoteState, supabase, updateDemo, user]);

  const reviewGitHubClaims = useCallback(async (solutionIds: string[], approve: boolean) => {
    if (!user) throw new Error("로그인이 필요합니다.");
    const uniqueIds = [...new Set(solutionIds)];
    if (!uniqueIds.length) return;
    if (isDemo) {
      updateDemo((current) => {
        const now = new Date().toISOString();
        const githubSolutions = current.githubSolutions.map((item) => uniqueIds.includes(item.id) && item.claimStatus === "pending" ? {
          ...item,
          claimStatus: approve ? "approved" as const : "rejected" as const,
          claimedBy: approve ? item.claimRequestedBy : undefined,
          claimReviewedBy: user.id,
          claimReviewedAt: now,
        } : item);
        return [{ ...current, githubSolutions }, undefined];
      });
      return;
    }
    const { error: rpcError } = await supabase!.rpc("review_github_solution_claims", { p_solution_ids: uniqueIds, p_approve: approve });
    if (rpcError) throw githubFeatureError(rpcError);
    await loadRemoteState();
  }, [isDemo, loadRemoteState, supabase, updateDemo, user]);

  const setGitHubAutoApprove = useCallback(async (studyId: string, enabled: boolean) => {
    if (!user) throw new Error("로그인이 필요합니다.");
    const study = state.studies.find((item) => item.id === studyId);
    if (!study || study.role === "member") throw new Error("설정을 변경할 권한이 없습니다.");
    if (isDemo) {
      updateDemo((current) => [{ ...current, studies: current.studies.map((item) => item.id === studyId ? { ...item, githubAutoApproveClaims: enabled } : item) }, undefined]);
      return;
    }
    const { error: rpcError } = await supabase!.rpc("set_github_claim_auto_approve", { p_study_id: studyId, p_enabled: enabled });
    if (rpcError) throw githubFeatureError(rpcError);
    setState((current) => ({ ...current, studies: current.studies.map((item) => item.id === studyId ? { ...item, githubAutoApproveClaims: enabled } : item) }));
  }, [isDemo, state.studies, supabase, updateDemo, user]);

  const syncGitHub = useCallback(async (input: SyncGitHubInput) => {
    if (!user) throw new Error("로그인이 필요합니다.");
    const repoUrl = input.repoUrl.trim().replace(/\.git$/, "");
    let entries: GitHubImportEntry[];

    if (input.sample) {
      entries = makeSampleGitHubEntries(repoUrl || "https://github.com/team/algostudy", input.branch || "main");
    } else {
      const { data: sessionData } = await supabase!.auth.getSession();
      const response = await fetch("/api/github/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
        },
        body: JSON.stringify({ repoUrl, branch: input.branch, rootPath: input.rootPath }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "GitHub 저장소를 가져오지 못했습니다.");
      entries = result.entries;
    }

    if (!entries.length) throw new Error("가져올 코드 파일이 없습니다.");
    const syncedAt = new Date().toISOString();

    if (isDemo) {
      return updateDemo((current) => {
        const nextWeeks = [...current.weeks];
        const nextProblems = [...current.problems];
        const nextSolutions = [...(current.githubSolutions ?? [])];

        for (const entry of entries) {
          let week = nextWeeks.find((item) => item.studyId === input.studyId && item.weekNumber === entry.weekNumber);
          if (!week) {
            week = {
              id: uid("week"), studyId: input.studyId, weekNumber: entry.weekNumber,
              title: `${entry.weekNumber}주차 · GitHub 가져오기`, description: "연결된 GitHub 저장소에서 가져온 학습 기록입니다.",
              dueDate: new Date(Date.now() + entry.weekNumber * 7 * 86400000).toISOString(), createdAt: syncedAt,
            };
            nextWeeks.push(week);
          }
          let problem = nextProblems.find((item) => item.weekId === week!.id && item.sourceKey?.toLowerCase() === entry.problemKey.toLowerCase());
          if (!problem) {
            problem = {
              id: uid("problem"), weekId: week.id, title: entry.problemTitle, url: entry.problemUrl,
              platform: platformFromUrl(entry.problemUrl), difficulty: "", required: true, createdAt: syncedAt, sourceKey: entry.problemKey,
            };
            nextProblems.push(problem);
          }
          const solution: GitHubSolution = {
            id: uid("github"), problemId: problem.id, authorLabel: entry.authorLabel, language: entry.language,
            code: entry.code, filePath: entry.filePath, htmlUrl: entry.htmlUrl, blobSha: entry.blobSha, syncedAt,
          };
          const existingIndex = nextSolutions.findIndex((item) => item.problemId === problem!.id && item.filePath === entry.filePath);
          if (existingIndex >= 0) nextSolutions[existingIndex] = { ...solution, id: nextSolutions[existingIndex].id };
          else nextSolutions.push(solution);
        }

        const studies = current.studies.map((study) => study.id === input.studyId ? {
          ...study, githubRepoUrl: repoUrl || "https://github.com/team/algostudy", githubBranch: input.branch || "main",
          githubRootPath: input.rootPath, githubSyncedAt: syncedAt,
        } : study);
        const next = { ...current, studies, weeks: nextWeeks, problems: nextProblems, githubSolutions: nextSolutions };
        return [next, {
          weeks: new Set(entries.map((entry) => entry.weekNumber)).size,
          problems: new Set(entries.map((entry) => `${entry.weekNumber}/${entry.problemKey.toLowerCase()}`)).size,
          solutions: entries.length,
        }];
      });
    }

    const study = state.studies.find((item) => item.id === input.studyId);
    if (!study || study.role === "member") throw new Error("방장 또는 운영진만 저장소를 연결할 수 있습니다.");
    const { error: studyError } = await supabase!.from("studies").update({
      github_repo_url: repoUrl, github_branch: input.branch || "main", github_root_path: input.rootPath, github_synced_at: syncedAt,
    }).eq("id", input.studyId);
    if (studyError) throw studyError;

    const weekMap = new Map<number, Week>();
    for (const entry of entries) {
      if (weekMap.has(entry.weekNumber)) continue;
      let week = state.weeks.find((item) => item.studyId === input.studyId && item.weekNumber === entry.weekNumber);
      if (!week) {
        const { data, error: weekError } = await supabase!.from("study_weeks").insert({
          study_id: input.studyId, week_number: entry.weekNumber, title: `${entry.weekNumber}주차 · GitHub 가져오기`,
          description: "연결된 GitHub 저장소에서 가져온 학습 기록입니다.",
          due_date: new Date(Date.now() + entry.weekNumber * 7 * 86400000).toISOString(),
        }).select().single();
        if (weekError) throw weekError;
        week = { id: data.id, studyId: data.study_id, weekNumber: data.week_number, title: data.title, description: data.description, dueDate: data.due_date, createdAt: data.created_at };
      }
      weekMap.set(entry.weekNumber, week);
    }

    const problemMap = new Map<string, Problem>();
    for (const entry of entries) {
      const mapKey = `${entry.weekNumber}/${entry.problemKey.toLowerCase()}`;
      if (problemMap.has(mapKey)) continue;
      const week = weekMap.get(entry.weekNumber)!;
      let problem = state.problems.find((item) => item.weekId === week.id && item.sourceKey?.toLowerCase() === entry.problemKey.toLowerCase());
      if (!problem) {
        const { data, error: problemError } = await supabase!.from("problems").insert({
          week_id: week.id, title: entry.problemTitle, url: entry.problemUrl, platform: platformFromUrl(entry.problemUrl),
          difficulty: "", required: true, source_key: entry.problemKey,
        }).select().single();
        if (problemError) throw problemError;
        problem = { id: data.id, weekId: data.week_id, title: data.title, url: data.url, platform: data.platform, difficulty: data.difficulty, required: data.required, createdAt: data.created_at, sourceKey: data.source_key };
      }
      problemMap.set(mapKey, problem);
    }

    const rows = entries.map((entry) => {
      const problem = problemMap.get(`${entry.weekNumber}/${entry.problemKey.toLowerCase()}`)!;
      return { problem_id: problem.id, author_label: entry.authorLabel, language: entry.language, code: entry.code, file_path: entry.filePath, html_url: entry.htmlUrl, blob_sha: entry.blobSha, synced_at: syncedAt };
    });
    const { error: solutionError } = await supabase!.from("github_solutions").upsert(rows, { onConflict: "problem_id,file_path" });
    if (solutionError) throw solutionError;
    await loadRemoteState();
    return {
      weeks: new Set(entries.map((entry) => entry.weekNumber)).size,
      problems: new Set(entries.map((entry) => `${entry.weekNumber}/${entry.problemKey.toLowerCase()}`)).size,
      solutions: entries.length,
    };
  }, [isDemo, loadRemoteState, state.problems, state.studies, state.weeks, supabase, updateDemo, user]);

  return (
    <StudyContext.Provider value={{ ...state, loading, error, refresh, createStudy, joinStudy, createWeek, createProblem, deleteProblem, removeMember, transferOwnership, deleteStudy, saveSubmission, addComment, addGitHubComment, requestGitHubClaim, reviewGitHubClaims, setGitHubAutoApprove, syncGitHub }}>
      {children}
    </StudyContext.Provider>
  );
}

export function useStudy() {
  const value = useContext(StudyContext);
  if (!value) throw new Error("useStudy must be used within StudyProvider");
  return value;
}
