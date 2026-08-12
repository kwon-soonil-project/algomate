"use client";

import { AppShell } from "@/components/app-shell";
import { CreateProblemModal } from "@/components/content-modals";
import { Protected } from "@/components/protected";
import { useAuth } from "@/lib/auth-context";
import { useStudy } from "@/lib/study-context";
import { initials } from "@/lib/utils";
import { ArrowUpRight, CalendarDays, ChevronRight, Circle, Github, Home, Plus, Presentation } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

export default function WeekPage() { return <Protected><WeekContent /></Protected>; }

function WeekContent() {
  const params = useParams<{ studyId: string; weekId: string }>();
  const { user } = useAuth();
  const { studies, weeks, problems, submissions, githubSolutions, loading } = useStudy();
  const [problemOpen, setProblemOpen] = useState(false);
  const study = studies.find((item) => item.id === params.studyId);
  const week = weeks.find((item) => item.id === params.weekId && item.studyId === params.studyId);
  const weekProblems = problems.filter((item) => item.weekId === params.weekId);

  if (loading) return <AppShell><div className="loading-page"><div className="spinner" /></div></AppShell>;
  if (!study || !week) return <AppShell><div className="page"><div className="empty-state"><h3>주차를 찾을 수 없어요</h3><Link className="btn btn-primary" href="/dashboard">대시보드로</Link></div></div></AppShell>;

  return (
    <AppShell breadcrumb={<><Home size={14} /><ChevronRight size={13} /><Link href={`/study/${study.id}`}>{study.name}</Link><ChevronRight size={13} /><strong>{week.weekNumber}주차</strong></>}>
      <div className="page narrow">
        <section className="week-detail-head">
          <span className="week-kicker">WEEK {String(week.weekNumber).padStart(2, "0")}</span>
          <div className="page-header" style={{ marginTop: 0 }}>
            <div><h1>{week.title}</h1><p>{week.description}</p><p style={{ marginTop: 10 }}><CalendarDays size={13} style={{ verticalAlign: -2, marginRight: 5 }} />{new Date(week.dueDate).toLocaleString("ko-KR", { month: "long", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit" })} 마감</p></div>
            {study.role !== "member" && <div className="page-actions"><button className="btn btn-primary" onClick={() => setProblemOpen(true)}><Plus size={15} /> 문제 등록</button></div>}
          </div>
        </section>

        <div className="section-row"><h2 className="section-title">이번 주 문제 <span style={{ color: "#a0a2b0", fontWeight: 500 }}>{weekProblems.length}</span></h2></div>
        {weekProblems.length ? <div className="problem-table">{weekProblems.map((problem) => {
          const mySubmission = submissions.find((item) => item.problemId === problem.id && item.userId === user?.id);
          const problemSubmissions = submissions.filter((item) => item.problemId === problem.id && item.status === "done");
          const importedSolutions = githubSolutions.filter((item) => item.problemId === problem.id);
          const status = mySubmission?.status ?? "todo";
          const problemUrl = `/study/${study.id}/week/${week.id}/problem/${problem.id}`;
          return <div className="problem-row" key={problem.id}>
            <Link className="problem-row-content" href={problemUrl}>
              <div className="problem-name"><strong>{problem.title}</strong><div className="problem-tags"><span>{problem.platform}</span><span>·</span><span>{problem.difficulty || "난이도 미정"}</span><span className={`badge ${problem.required ? "required" : "optional"}`}>{problem.required ? "필수" : "선택"}</span>{importedSolutions.length > 0 && <span className="badge github-badge"><Github size={9} /> GitHub</span>}</div></div>
              <div className="submission-avatars">{[...problemSubmissions.map((item) => ({ id: item.id, name: item.userName })), ...importedSolutions.map((item) => ({ id: item.id, name: item.authorLabel }))].slice(0,4).map((submission, index) => <span className={`avatar sm ${index % 3 === 1 ? "mint" : index % 3 === 2 ? "amber" : ""}`} title={submission.name} key={submission.id}>{initials(submission.name)}</span>)}</div>
              <span className="completion">{problemSubmissions.length + importedSolutions.length}개 풀이</span>
              <span className={`badge ${status === "done" ? "done" : status === "in_progress" ? "progress" : "todo"}`}>{status === "done" ? "완료" : status === "in_progress" ? "진행 중" : "시작 전"}</span>
              <ChevronRight size={16} color="#a2a4b1" />
            </Link>
            <Link className="review-row-link" href={`${problemUrl}/review`} title={`${problem.title} 리뷰 모드`} aria-label={`${problem.title} 리뷰 모드`}><Presentation size={15} /><span>리뷰</span></Link>
          </div>;
        })}</div> : <div className="empty-state"><span className="empty-icon"><Circle size={22} /></span><h3>아직 문제가 없어요</h3><p>외부 문제 링크를 등록해 이번 주 학습을 시작하세요.</p>{study.role !== "member" && <button className="btn btn-primary" onClick={() => setProblemOpen(true)}><Plus size={15} /> 첫 문제 등록</button>}</div>}

        {weekProblems.length > 0 && <div style={{ marginTop: 18, color: "#9194a3", fontSize: 11 }}><ArrowUpRight size={13} style={{ verticalAlign: -2, marginRight: 5 }} />문제를 열면 원문 링크와 코드 에디터를 함께 이용할 수 있어요.</div>}
      </div>
      <CreateProblemModal weekId={week.id} open={problemOpen} onClose={() => setProblemOpen(false)} />
    </AppShell>
  );
}
