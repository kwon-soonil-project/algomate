"use client";

import { AppShell } from "@/components/app-shell";
import { Protected } from "@/components/protected";
import { useStudy } from "@/lib/study-context";
import { initials } from "@/lib/utils";
import { ArrowLeft, ChevronRight, Code2, Columns2, ExternalLink, Github, Home, MessageCircle, Presentation, Users } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const CodeEditor = dynamic(() => import("@/components/code-editor").then((module) => module.CodeEditor), { ssr: false });

interface ReviewSolution {
  id: string;
  name: string;
  language: string;
  code: string;
  explanation: string;
  complexity: string;
  source: "algomate" | "github";
  sourceUrl?: string;
  filePath?: string;
  updatedAt: string;
  submissionId?: string;
}

export default function ReviewPage() {
  return <Protected><ReviewContent /></Protected>;
}

function ReviewContent() {
  const params = useParams<{ studyId: string; weekId: string; problemId: string }>();
  const { studies, weeks, problems, submissions, githubSolutions, comments, loading } = useStudy();
  const study = studies.find((item) => item.id === params.studyId);
  const week = weeks.find((item) => item.id === params.weekId);
  const problem = problems.find((item) => item.id === params.problemId);

  const solutions = useMemo<ReviewSolution[]>(() => [
    ...submissions.filter((item) => item.problemId === params.problemId).map((item) => ({
      id: item.id,
      name: item.userName,
      language: item.language,
      code: item.code,
      explanation: item.explanation,
      complexity: item.complexity,
      source: "algomate" as const,
      updatedAt: item.updatedAt,
      submissionId: item.id,
    })),
    ...githubSolutions.filter((item) => item.problemId === params.problemId).map((item) => ({
      id: item.id,
      name: item.authorLabel,
      language: item.language,
      code: item.code,
      explanation: "GitHub 저장소에서 가져온 풀이",
      complexity: "",
      source: "github" as const,
      sourceUrl: item.htmlUrl,
      filePath: item.filePath,
      updatedAt: item.syncedAt,
    })),
  ], [githubSolutions, params.problemId, submissions]);

  const [primaryId, setPrimaryId] = useState("");
  const [compareId, setCompareId] = useState("");
  const [compareMode, setCompareMode] = useState(false);

  useEffect(() => {
    if (!primaryId && solutions[0]) setPrimaryId(solutions[0].id);
  }, [primaryId, solutions]);

  useEffect(() => {
    if (compareMode && (!compareId || compareId === primaryId)) {
      setCompareId(solutions.find((item) => item.id !== primaryId)?.id ?? "");
    }
  }, [compareId, compareMode, primaryId, solutions]);

  const primary = solutions.find((item) => item.id === primaryId) ?? solutions[0];
  const comparison = solutions.find((item) => item.id === compareId && item.id !== primary?.id);
  const primaryComments = comments.filter((item) => item.submissionId === primary?.submissionId);

  if (loading) return <AppShell><div className="loading-page"><div className="spinner" /></div></AppShell>;
  if (!study || !week || !problem) return <AppShell><div className="page"><div className="empty-state"><h3>문제를 찾을 수 없어요</h3><Link className="btn btn-primary" href="/dashboard">대시보드로</Link></div></div></AppShell>;

  const editorUrl = `/study/${study.id}/week/${week.id}/problem/${problem.id}`;

  return (
    <AppShell breadcrumb={<><Home size={14} /><ChevronRight size={13} /><Link href={`/study/${study.id}`}>{study.name}</Link><ChevronRight size={13} /><Link href={`/study/${study.id}/week/${week.id}`}>{week.weekNumber}주차</Link><ChevronRight size={13} /><strong>리뷰 모드</strong></>}>
      <div className="review-mode-page">
        <header className="review-mode-header">
          <div className="review-title-wrap">
            <span className="review-mode-icon"><Presentation size={18} /></span>
            <div><span className="review-kicker">STUDY REVIEW</span><h1>{problem.title}</h1><p>{problem.platform} · {problem.difficulty || "난이도 미정"} · {solutions.length}개 풀이</p></div>
          </div>
          <div className="review-header-actions">
            <a className="btn btn-secondary btn-sm" href={problem.url} target="_blank" rel="noreferrer">문제 원문 <ExternalLink size={12} /></a>
            <Link className="btn btn-secondary btn-sm" href={editorUrl}><Code2 size={14} /> 작성 화면</Link>
            <Link className="btn btn-ghost btn-sm" href={`/study/${study.id}/week/${week.id}`}><ArrowLeft size={14} /> 문제 목록</Link>
          </div>
        </header>

        {solutions.length ? <>
          <section className="review-selector-bar">
            <div className="review-person-tabs" role="tablist" aria-label="풀이 작성자">
              {solutions.map((solution, index) => <button type="button" role="tab" aria-selected={primary?.id === solution.id} className={`review-person ${primary?.id === solution.id ? "active" : ""}`} onClick={() => setPrimaryId(solution.id)} key={solution.id}><span className={`avatar sm ${index % 3 === 1 ? "mint" : index % 3 === 2 ? "amber" : ""}`}>{initials(solution.name)}</span><span><strong>{solution.name}</strong><small>{solution.source === "github" ? <><Github size={9} /> GitHub</> : solution.language}</small></span></button>)}
            </div>
            <button className={`btn btn-sm ${compareMode ? "btn-primary" : "btn-secondary"}`} disabled={solutions.length < 2} onClick={() => setCompareMode((value) => !value)}><Columns2 size={14} /> {compareMode ? "비교 닫기" : "두 풀이 비교"}</button>
          </section>

          {compareMode && <section className="compare-controls">
            <label><span>왼쪽 풀이</span><select className="select" value={primary?.id} onChange={(event) => setPrimaryId(event.target.value)}>{solutions.map((solution) => <option value={solution.id} key={solution.id}>{solution.name} · {solution.language}</option>)}</select></label>
            <span className="compare-vs">VS</span>
            <label><span>오른쪽 풀이</span><select className="select" value={comparison?.id ?? ""} onChange={(event) => setCompareId(event.target.value)}>{solutions.filter((solution) => solution.id !== primary?.id).map((solution) => <option value={solution.id} key={solution.id}>{solution.name} · {solution.language}</option>)}</select></label>
          </section>}

          <section className={`review-code-grid ${compareMode && comparison ? "comparing" : ""}`}>
            {primary && <SolutionPanel solution={primary} side="첫 번째" />}
            {compareMode && comparison && <SolutionPanel solution={comparison} side="두 번째" />}
          </section>

          {!compareMode && primary && <section className="review-notes-grid">
            <article className="review-note-card"><div className="review-note-heading"><Code2 size={15} /><h2>풀이 설명</h2></div><p>{primary.explanation || "작성된 풀이 설명이 없습니다."}</p>{primary.complexity && <span className="complexity-chip">복잡도 {primary.complexity}</span>}</article>
            <article className="review-note-card"><div className="review-note-heading"><MessageCircle size={15} /><h2>팀 피드백</h2><span>{primaryComments.length}</span></div>{primary.source === "github" ? <p>GitHub에서 가져온 코드는 원본 파일 링크에서 리뷰할 수 있어요.</p> : primaryComments.length ? <div className="review-comment-list">{primaryComments.map((comment) => <div key={comment.id}><strong>{comment.userName}</strong><span>{comment.kind === "question" ? "질문" : "피드백"}</span><p>{comment.body}</p></div>)}</div> : <p>아직 남겨진 피드백이 없습니다.</p>}</article>
          </section>}
        </> : <div className="review-empty"><span><Users size={26} /></span><h2>아직 볼 수 있는 풀이가 없어요</h2><p>팀원이 코드를 저장하거나 GitHub 저장소를 동기화하면 이곳에서 함께 볼 수 있습니다.</p><Link className="btn btn-primary" href={editorUrl}>첫 풀이 작성하기</Link></div>}
      </div>
    </AppShell>
  );
}

function SolutionPanel({ solution, side }: { solution: ReviewSolution; side: string }) {
  return <article className="review-code-panel">
    <header><div><span className="avatar">{initials(solution.name)}</span><span><strong>{solution.name}</strong><small>{solution.source === "github" ? solution.filePath : `${solution.language} · AlgoMate`}</small></span></div><div className="review-source">{solution.source === "github" ? <Github size={13} /> : <Code2 size={13} />}<span>{solution.source === "github" ? "GitHub" : side}</span>{solution.sourceUrl && <a href={solution.sourceUrl} target="_blank" rel="noreferrer" aria-label="GitHub 원본 보기"><ExternalLink size={12} /></a>}</div></header>
    <div className="review-monaco"><CodeEditor value={solution.code} language={solution.language} readOnly /></div>
  </article>;
}
