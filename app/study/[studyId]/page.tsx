"use client";

import { AppShell } from "@/components/app-shell";
import { CreateWeekModal } from "@/components/content-modals";
import { GitHubImportModal } from "@/components/github-import-modal";
import { Protected } from "@/components/protected";
import { StudyManagementModal } from "@/components/study-management-modal";
import { useAuth } from "@/lib/auth-context";
import { useStudy } from "@/lib/study-context";
import { useToast } from "@/lib/toast-context";
import { initials } from "@/lib/utils";
import { CalendarDays, Check, ChevronRight, Copy, Github, Home, Plus, RefreshCw, Settings } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

export default function StudyPage() { return <Protected><StudyContent /></Protected>; }

function StudyContent() {
  const params = useParams<{ studyId: string }>();
  const { user } = useAuth();
  const { studies, members, weeks, problems, submissions, githubSolutions, loading } = useStudy();
  const { toast } = useToast();
  const [weekOpen, setWeekOpen] = useState(false);
  const [githubOpen, setGithubOpen] = useState(false);
  const [managementOpen, setManagementOpen] = useState(false);
  const study = studies.find((item) => item.id === params.studyId);
  const studyWeeks = weeks.filter((week) => week.studyId === params.studyId).sort((a,b) => b.weekNumber - a.weekNumber);
  const studyMembers = members.filter((member) => member.studyId === params.studyId);

  if (loading) return <AppShell><div className="loading-page"><div className="spinner" /></div></AppShell>;
  if (!study) return <AppShell><div className="page"><div className="empty-state"><h3>스터디를 찾을 수 없어요</h3><p>초대 코드를 확인하거나 대시보드로 돌아가 주세요.</p><Link className="btn btn-primary" href="/dashboard">대시보드로</Link></div></div></AppShell>;

  async function copyInvite() {
    await navigator.clipboard.writeText(study!.inviteCode);
    toast("초대 코드를 복사했어요.");
  }

  return (
    <AppShell breadcrumb={<><Home size={14} /><ChevronRight size={13} /><strong>{study.name}</strong></>}>
      <div className="page">
        <section className="study-hero">
          <span className={`study-card-icon study-dot ${study.color}`}>{initials(study.name)}</span>
          <div><h1>{study.name}</h1><p>{study.description}</p></div>
          <div className="study-meta-actions"><button className="btn btn-secondary btn-sm" onClick={copyInvite}><Copy size={14} /> 초대 코드</button>{study.role !== "member" && <><button className="btn btn-secondary btn-sm" onClick={() => setGithubOpen(true)}>{study.githubRepoUrl ? <RefreshCw size={14} /> : <Github size={14} />} {study.githubRepoUrl ? "GitHub 동기화" : "GitHub 가져오기"}</button><button className="btn btn-secondary btn-sm" onClick={() => setManagementOpen(true)}><Settings size={14} /> 관리</button></>}</div>
        </section>

        <nav className="tab-list"><span className="tab active">주차별 학습</span><span className="tab">멤버 <b>{studyMembers.length}</b></span></nav>
        <div className="content-layout">
          <section>
            <div className="section-row"><h2 className="section-title">학습 일정</h2>{study.role !== "member" && <button className="btn btn-primary btn-sm" onClick={() => setWeekOpen(true)}><Plus size={14} /> 주차 추가</button>}</div>
            {studyWeeks.length ? <div className="week-list">{studyWeeks.map((week) => {
              const weekProblems = problems.filter((problem) => problem.weekId === week.id);
              const myDone = submissions.filter((submission) => submission.userId === user?.id && submission.status === "done" && weekProblems.some((problem) => problem.id === submission.problemId)).length;
              const progress = weekProblems.length ? Math.round((myDone / weekProblems.length) * 100) : 0;
              return <Link href={`/study/${study.id}/week/${week.id}`} className="week-card" key={week.id}>
                <div className="week-header">
                  <span className="week-number">{week.weekNumber}주</span>
                  <div className="week-title"><h3>{week.title}</h3><p><CalendarDays size={11} style={{ verticalAlign: -2, marginRight: 4 }} />{new Date(week.dueDate).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })} 마감 · {weekProblems.length}문제</p></div>
                  <div className="week-progress"><strong>{myDone}/{weekProblems.length} 완료</strong><div className="progress"><span style={{ width: `${progress}%` }} /></div></div>
                  <ChevronRight className="week-chevron" size={17} />
                </div>
                {weekProblems.length > 0 && <div className="week-problems">{weekProblems.slice(0,3).map((problem) => {
                  const mySubmission = submissions.find((submission) => submission.problemId === problem.id && submission.userId === user?.id);
                  const importedCount = githubSolutions.filter((solution) => solution.problemId === problem.id).length;
                  return <div className="mini-problem" key={problem.id}><span className={`badge ${mySubmission?.status === "done" ? "done" : mySubmission?.status === "in_progress" ? "progress" : "todo"}`}>{mySubmission?.status === "done" ? <Check size={10} /> : mySubmission?.status === "in_progress" ? "진행 중" : "시작 전"}</span><span className="mini-problem-title">{problem.title}</span>{importedCount > 0 && <span className="badge github-badge"><Github size={9} /> {importedCount}</span>}<span className="platform">{problem.platform} · {problem.difficulty}</span></div>;
                })}</div>}
              </Link>;
            })}</div> : <div className="empty-state"><span className="empty-icon"><CalendarDays size={22} /></span><h3>아직 등록된 주차가 없어요</h3><p>첫 학습 주제를 만들고 문제를 등록해 보세요.</p>{study.role !== "member" && <button className="btn btn-primary" onClick={() => setWeekOpen(true)}><Plus size={15} /> 첫 주차 만들기</button>}</div>}
          </section>

          <aside className="study-aside">
            {study.githubRepoUrl && <div className="right-card github-connected"><div className="github-connected-head"><span className="github-logo"><Github size={16} /></span><div><h3>GitHub 연결됨</h3><p>{study.githubRepoUrl.replace("https://github.com/", "")}</p></div></div><div className="github-connected-meta"><span>{study.githubBranch || "main"} 브랜치</span><button className="btn btn-ghost btn-sm" onClick={() => setGithubOpen(true)}>다시 동기화</button></div></div>}
            <div className="right-card"><h3>초대 코드</h3><div className="invite-code"><strong>{study.inviteCode}</strong><button className="btn btn-ghost btn-icon btn-sm" onClick={copyInvite} aria-label="코드 복사"><Copy size={14} /></button></div><p className="form-hint" style={{ marginBottom: 0 }}>코드를 공유하면 팀원이 바로 참여할 수 있어요.</p></div>
            <div className="right-card"><h3 style={{ display: "flex", justifyContent: "space-between" }}><span>팀원</span><span style={{ color: "#999baa", fontWeight: 500 }}>{studyMembers.length}명</span></h3><div className="member-list">{studyMembers.slice(0,6).map((member, index) => <div className="member-row" key={member.id}><span className={`avatar sm ${index % 3 === 1 ? "mint" : index % 3 === 2 ? "amber" : ""}`}>{initials(member.name)}</span><span className="user-meta"><span className="user-name">{member.name}{member.userId === user?.id ? " (나)" : ""}</span><span className="user-email">{member.role === "owner" ? "방장" : member.role === "admin" ? "운영진" : "멤버"}</span></span></div>)}</div></div>
          </aside>
        </div>
      </div>
      <CreateWeekModal studyId={study.id} open={weekOpen} onClose={() => setWeekOpen(false)} />
      <GitHubImportModal studyId={study.id} open={githubOpen} onClose={() => setGithubOpen(false)} initialRepoUrl={study.githubRepoUrl} initialBranch={study.githubBranch} initialRootPath={study.githubRootPath} />
      <StudyManagementModal study={study} members={studyMembers} currentUserId={user!.id} open={managementOpen} onClose={() => setManagementOpen(false)} />
    </AppShell>
  );
}
