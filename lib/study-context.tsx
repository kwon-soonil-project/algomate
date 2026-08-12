"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { demoState } from "./demo-data";
import { makeSampleGitHubEntries } from "./github-import";
import { useAuth } from "./auth-context";
import { getSupabaseBrowserClient } from "./supabase";
import type { Comment, GitHubImportEntry, GitHubSolution, Problem, ProblemStatus, Study, StudyMember, StudyState, Submission, Week } from "./types";
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
  saveSubmission: (input: SaveSubmissionInput) => Promise<Submission>;
  addComment: (submissionId: string, body: string, kind: Comment["kind"]) => Promise<Comment>;
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
    return { ...parsed, githubSolutions: parsed.githubSolutions ?? [] };
  } catch {
    return structuredClone(demoState);
  }
}

function persistDemoState(state: StudyState) {
  window.localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(state));
}

export function StudyProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, isDemo } = useAuth();
  const [state, setState] = useState<StudyState>({ studies: [], members: [], weeks: [], problems: [], submissions: [], comments: [], githubSolutions: [] });
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
      } as Study] : [];
    });

    if (!studies.length) {
      setState({ studies: [], members: [], weeks: [], problems: [], submissions: [], comments: [], githubSolutions: [] });
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
    }));
    setState({ studies, members, weeks, problems, submissions, comments, githubSolutions });
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
      setState({ studies: [], members: [], weeks: [], problems: [], submissions: [], comments: [], githubSolutions: [] });
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
    <StudyContext.Provider value={{ ...state, loading, error, refresh, createStudy, joinStudy, createWeek, createProblem, saveSubmission, addComment, syncGitHub }}>
      {children}
    </StudyContext.Provider>
  );
}

export function useStudy() {
  const value = useContext(StudyContext);
  if (!value) throw new Error("useStudy must be used within StudyProvider");
  return value;
}
