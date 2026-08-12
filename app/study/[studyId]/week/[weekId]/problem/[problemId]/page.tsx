"use client";

import { AppShell } from "@/components/app-shell";
import { GitHubSolutionDiscussion } from "@/components/github-solution-discussion";
import { Protected } from "@/components/protected";
import { useAuth } from "@/lib/auth-context";
import { useStudy } from "@/lib/study-context";
import { useToast } from "@/lib/toast-context";
import { initials, languageExtension } from "@/lib/utils";
import type { ProblemStatus } from "@/lib/types";
import { Check, ChevronRight, ExternalLink, Github, Home, MessageCircle, Presentation, Save } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

const CodeEditor = dynamic(() => import("@/components/code-editor").then((module) => module.CodeEditor), { ssr: false });

const starterCode: Record<string, string> = {
  python: "def solution():\n    # 여기에 풀이를 작성하세요.\n    pass\n",
  javascript: "function solution() {\n  // 여기에 풀이를 작성하세요.\n}\n",
  typescript: "function solution(): void {\n  // 여기에 풀이를 작성하세요.\n}\n",
  java: "class Solution {\n    public static void main(String[] args) {\n        // 여기에 풀이를 작성하세요.\n    }\n}\n",
  cpp: "#include <iostream>\nusing namespace std;\n\nint main() {\n    // 여기에 풀이를 작성하세요.\n    return 0;\n}\n",
  kotlin: "fun main() {\n    // 여기에 풀이를 작성하세요.\n}\n",
  go: "package main\n\nfunc main() {\n    // 여기에 풀이를 작성하세요.\n}\n",
  rust: "fn main() {\n    // 여기에 풀이를 작성하세요.\n}\n",
};

export default function ProblemPage() { return <Protected><ProblemContent /></Protected>; }

function ProblemContent() {
  const params = useParams<{ studyId: string; weekId: string; problemId: string }>();
  const { user } = useAuth();
  const { studies, members, weeks, problems, submissions, githubSolutions, comments, saveSubmission, addComment, loading } = useStudy();
  const { toast } = useToast();
  const study = studies.find((item) => item.id === params.studyId);
  const week = weeks.find((item) => item.id === params.weekId);
  const problem = problems.find((item) => item.id === params.problemId);
  const problemSubmissions = useMemo(() => submissions.filter((item) => item.problemId === params.problemId), [params.problemId, submissions]);
  const importedSolutions = useMemo(() => githubSolutions.filter((item) => item.problemId === params.problemId), [githubSolutions, params.problemId]);
  const studyMembers = members.filter((item) => item.studyId === params.studyId);
  const mine = problemSubmissions.find((item) => item.userId === user?.id);

  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(starterCode.python);
  const [explanation, setExplanation] = useState("");
  const [complexity, setComplexity] = useState("");
  const [status, setStatus] = useState<ProblemStatus>("todo");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [commentKind, setCommentKind] = useState<"feedback" | "question">("feedback");
  const [commentPending, setCommentPending] = useState(false);
  const hydrated = useRef(false);
  const editorDraftKey = `algomate:draft:solution:${params.problemId}:${user?.id ?? "anonymous"}`;

  useEffect(() => {
    if (hydrated.current || loading) return;
    try {
      const stored = window.localStorage.getItem(editorDraftKey);
      if (stored) {
        const draft = JSON.parse(stored) as { language: string; code: string; explanation: string; complexity: string; status: ProblemStatus };
        setLanguage(draft.language); setCode(draft.code); setExplanation(draft.explanation); setComplexity(draft.complexity); setStatus(draft.status); setDirty(true);
      } else if (mine) {
        setLanguage(mine.language); setCode(mine.code); setExplanation(mine.explanation); setComplexity(mine.complexity); setStatus(mine.status); setSelectedId(mine.id);
      }
    } catch {
      window.localStorage.removeItem(editorDraftKey);
    }
    hydrated.current = true;
  }, [editorDraftKey, loading, mine]);

  useEffect(() => {
    if (!dirty || !hydrated.current) return;
    window.localStorage.setItem(editorDraftKey, JSON.stringify({ language, code, explanation, complexity, status }));
  }, [code, complexity, dirty, editorDraftKey, explanation, language, status]);

  useEffect(() => {
    if (!selectedId) setSelectedId(problemSubmissions[0]?.id ?? importedSolutions[0]?.id ?? null);
  }, [importedSolutions, problemSubmissions, selectedId]);

  const persist = useCallback(async (nextStatus: ProblemStatus, silent = false) => {
    setSaving(true);
    try {
      const saved = await saveSubmission({ problemId: params.problemId, language, code, explanation, complexity, status: nextStatus });
      window.localStorage.removeItem(editorDraftKey);
      setStatus(nextStatus); setDirty(false); setSelectedId(saved.id);
      if (!silent) toast(nextStatus === "done" ? "풀이를 완료로 표시했어요." : "코드를 저장했어요.");
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : "저장하지 못했습니다.");
    } finally { setSaving(false); }
  }, [code, complexity, editorDraftKey, explanation, language, params.problemId, saveSubmission, toast]);

  useEffect(() => {
    if (!dirty || !hydrated.current) return;
    const timer = window.setTimeout(() => void persist(status === "todo" ? "in_progress" : status, true), 2200);
    return () => window.clearTimeout(timer);
  }, [dirty, persist, status]);

  function switchLanguage(next: string) {
    const untouched = code === starterCode[language] || (!mine && code.trim().length < 55);
    setLanguage(next);
    if (untouched) setCode(starterCode[next] ?? "");
    setDirty(true);
  }

  const selected = problemSubmissions.find((item) => item.id === selectedId) ?? mine ?? problemSubmissions[0];
  const selectedGithub = importedSolutions.find((item) => item.id === selectedId) ?? (!selected ? importedSolutions[0] : undefined);
  const selectedComments = comments.filter((item) => item.submissionId === selected?.id);

  async function submitComment(event: FormEvent) {
    event.preventDefault();
    if (!selected || selectedGithub || !commentBody.trim()) return;
    setCommentPending(true);
    try { await addComment(selected.id, commentBody.trim(), commentKind); setCommentBody(""); toast("댓글을 남겼어요."); }
    catch (reason) { toast(reason instanceof Error ? reason.message : "댓글을 남기지 못했습니다."); }
    finally { setCommentPending(false); }
  }

  if (loading) return <AppShell><div className="loading-page"><div className="spinner" /></div></AppShell>;
  if (!study || !week || !problem) return <AppShell><div className="page"><div className="empty-state"><h3>문제를 찾을 수 없어요</h3><Link className="btn btn-primary" href="/dashboard">대시보드로</Link></div></div></AppShell>;

  return (
    <AppShell breadcrumb={<><Home size={14} /><ChevronRight size={13} /><Link href={`/study/${study.id}`}>{study.name}</Link><ChevronRight size={13} /><Link href={`/study/${study.id}/week/${week.id}`}>{week.weekNumber}주차</Link><ChevronRight size={13} /><strong>{problem.title}</strong></>}>
      <div className="editor-page">
        <header className="problem-toolbar">
          <div className="problem-toolbar-main"><h1>{problem.title}</h1><div className="problem-toolbar-meta"><span>{problem.platform}</span><span>·</span><span>{problem.difficulty || "난이도 미정"}</span><span className={`badge ${problem.required ? "required" : "optional"}`}>{problem.required ? "필수" : "선택"}</span></div></div>
          <a className="btn btn-secondary btn-sm" href={problem.url} target="_blank" rel="noreferrer">문제 원문 <ExternalLink size={13} /></a>
          <Link className="btn btn-secondary btn-sm" href={`/study/${study.id}/week/${week.id}/problem/${problem.id}/review`}><Presentation size={14} /> 리뷰 모드</Link>
          <button className="btn btn-secondary btn-sm" onClick={() => void persist(status === "todo" ? "in_progress" : status)} disabled={saving}><Save size={14} /> {saving ? "저장 중" : dirty ? "저장" : "저장됨"}</button>
          <button className="btn btn-primary btn-sm" onClick={() => void persist("done")} disabled={saving || status === "done"}><Check size={14} /> {status === "done" ? "완료됨" : "풀이 완료"}</button>
        </header>

        <div className="editor-layout">
          <section className="editor-pane" aria-label="코드 작성 영역">
            <div className="editor-tabs"><span className="editor-tab-name"><span style={{ color: "#7d70e5" }}>●</span> solution.{languageExtension(language)} {dirty && <span style={{ color: "#8b8998" }}>• 수정됨</span>}</span><select className="language-select" value={language} onChange={(event) => switchLanguage(event.target.value)} aria-label="프로그래밍 언어"><option value="python">Python</option><option value="javascript">JavaScript</option><option value="typescript">TypeScript</option><option value="java">Java</option><option value="cpp">C++</option><option value="kotlin">Kotlin</option><option value="go">Go</option><option value="rust">Rust</option></select></div>
            <div className="monaco-wrap"><CodeEditor language={language} value={code} onChange={(next) => { setCode(next); setDirty(true); }} /></div>
            <div className="editor-footer">
              <div className="dark-field"><label>풀이 설명</label><textarea value={explanation} onChange={(event) => { setExplanation(event.target.value); setDirty(true); }} placeholder="어떤 방식으로 접근했는지 간단히 기록해 보세요." /></div>
              <div className="dark-field"><label>시간 · 공간 복잡도</label><input value={complexity} onChange={(event) => { setComplexity(event.target.value); setDirty(true); }} placeholder="예: O(N log N)" /><div style={{ marginTop: 17, color: "#777584", fontSize: 9, lineHeight: 1.5 }}>수정 내용은 잠시 후 자동 저장되며 팀원에게 바로 공개됩니다.</div></div>
            </div>
          </section>

          <aside className="review-pane" aria-label="팀원 코드와 피드백">
            <section className="review-section">
              <h3>팀원 풀이 <span style={{ color: "#9a9cab", fontWeight: 500 }}>{problemSubmissions.length + importedSolutions.length}</span></h3>
              {problemSubmissions.length || importedSolutions.length ? <><div className="submission-tabs">{problemSubmissions.map((submission, index) => <button key={submission.id} className={`submission-tab ${selected?.id === submission.id && !selectedGithub ? "active" : ""}`} onClick={() => setSelectedId(submission.id)}><span className={`avatar sm ${index % 3 === 1 ? "mint" : index % 3 === 2 ? "amber" : ""}`} style={{ width: 20, height: 20, fontSize: 8 }}>{initials(submission.userName)}</span>{submission.userId === user?.id ? "내 풀이" : submission.userName}</button>)}{importedSolutions.map((solution, index) => <button key={solution.id} className={`submission-tab github-tab ${selectedGithub?.id === solution.id ? "active" : ""}`} onClick={() => setSelectedId(solution.id)}><Github size={12} /><span className={`avatar sm ${index % 3 === 1 ? "mint" : ""}`} style={{ width: 20, height: 20, fontSize: 8 }}>{initials(solution.authorLabel)}</span>{solution.authorLabel}</button>)}</div>{selectedGithub ? <><div className="github-file-meta"><span><Github size={12} /> {selectedGithub.filePath}</span><a href={selectedGithub.htmlUrl} target="_blank" rel="noreferrer">원본 보기 <ExternalLink size={10} /></a></div><pre className="peer-code">{selectedGithub.code}</pre></> : selected && <><pre className="peer-code">{selected.code}</pre>{selected.explanation && <p style={{ color: "#656879", fontSize: 10, lineHeight: 1.6, marginBottom: 0 }}>{selected.explanation}</p>}</>}</> : <p className="form-hint">아직 공유된 풀이가 없습니다. 코드를 저장하면 첫 풀이가 공개돼요.</p>}
            </section>

            {selectedGithub ? <GitHubSolutionDiscussion solution={selectedGithub} study={study} members={studyMembers} /> : <><section className="review-section" style={{ borderBottom: 0 }}>
              <h3>피드백과 질문 <span style={{ color: "#9a9cab", fontWeight: 500 }}>{selectedComments.length}</span></h3>
              {selectedComments.length ? <div className="comment-list">{selectedComments.map((comment, index) => <article className="comment" key={comment.id}><span className={`avatar sm ${index % 3 === 1 ? "mint" : index % 3 === 2 ? "amber" : ""}`}>{initials(comment.userName)}</span><div className="comment-body"><div className="comment-meta"><strong>{comment.userName}</strong><span className="comment-kind">{comment.kind === "question" ? "질문" : "피드백"}</span><time>{new Date(comment.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}</time></div><p>{comment.body}</p></div></article>)}</div> : <p className="form-hint">아직 댓글이 없어요. 첫 피드백을 남겨 보세요.</p>}
            </section>
            <form className="comment-form" onSubmit={submitComment}>
              <textarea className="textarea" value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder={selected ? `${selected.userName}님의 풀이에 의견을 남겨 주세요.` : "먼저 코드를 저장해 주세요."} disabled={!selected} />
              <div className="comment-form-actions"><div className="kind-toggle"><button type="button" className={`kind-button ${commentKind === "feedback" ? "active" : ""}`} onClick={() => setCommentKind("feedback")}>피드백</button><button type="button" className={`kind-button ${commentKind === "question" ? "active" : ""}`} onClick={() => setCommentKind("question")}>질문</button></div><button className="btn btn-primary btn-sm" disabled={!selected || !commentBody.trim() || commentPending}><MessageCircle size={13} /> 등록</button></div>
            </form></>}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
