"use client";

import { AppShell } from "@/components/app-shell";
import { Protected } from "@/components/protected";
import { useAuth } from "@/lib/auth-context";
import { useStudy } from "@/lib/study-context";
import { initials } from "@/lib/utils";
import { BookOpen, CheckCircle2, ChevronRight, Clock3, MessageCircle, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CreateStudyModal } from "@/components/study-modals";

export default function DashboardPage() {
  return <Protected><DashboardContent /></Protected>;
}

function DashboardContent() {
  const { user } = useAuth();
  const { studies, members, weeks, problems, submissions, comments, loading } = useStudy();
  const [createOpen, setCreateOpen] = useState(false);
  const myDone = submissions.filter((item) => item.userId === user?.id && item.status === "done").length;
  const myComments = comments.filter((item) => item.userId !== user?.id).length;
  const upcoming = weeks.length;

  return (
    <AppShell>
      <div className="page">
        <section className="welcome-card">
          <h1>좋은 하루예요, {user?.name}님 👋</h1>
          <p>오늘도 한 문제씩, 어제보다 단단하게 성장해요.</p>
        </section>

        <section className="stat-grid" aria-label="학습 현황">
          <div className="stat-card"><span className="stat-icon violet"><BookOpen size={19} /></span><div><div className="stat-value">{studies.length}</div><div className="stat-label">참여 중인 스터디</div></div></div>
          <div className="stat-card"><span className="stat-icon mint"><CheckCircle2 size={19} /></span><div><div className="stat-value">{myDone}</div><div className="stat-label">완료한 문제</div></div></div>
          <div className="stat-card"><span className="stat-icon amber"><MessageCircle size={19} /></span><div><div className="stat-value">{myComments}</div><div className="stat-label">받은 피드백</div></div></div>
        </section>

        <div className="section-row"><h2 className="section-title">내 스터디</h2><button className="btn btn-secondary btn-sm" onClick={() => setCreateOpen(true)}><Plus size={14} /> 새 스터디</button></div>
        {loading ? <div className="study-grid">{[0,1].map((item) => <div key={item} className="study-card skeleton" style={{ height: 210 }} />)}</div> : studies.length ? (
          <div className="study-grid">
            {studies.map((study) => {
              const studyWeeks = weeks.filter((week) => week.studyId === study.id);
              const studyProblems = problems.filter((problem) => studyWeeks.some((week) => week.id === problem.weekId));
              const done = submissions.filter((submission) => submission.userId === user?.id && submission.status === "done" && studyProblems.some((problem) => problem.id === submission.problemId)).length;
              const studyMembers = members.filter((member) => member.studyId === study.id);
              return (
                <Link className="study-card" href={`/study/${study.id}`} key={study.id}>
                  <div className="study-card-top">
                    <span className={`study-card-icon study-dot ${study.color}`}>{initials(study.name)}</span>
                    <span className="role-badge">{study.role === "owner" ? "방장" : study.role === "admin" ? "운영진" : "멤버"}</span>
                  </div>
                  <h3>{study.name}</h3>
                  <p>{study.description}</p>
                  <div className="study-card-footer">
                    <div className="member-stack">{studyMembers.slice(0, 4).map((member, index) => <span className={`avatar sm ${index % 3 === 1 ? "mint" : index % 3 === 2 ? "amber" : ""}`} key={member.id}>{initials(member.name)}</span>)}</div>
                    <span>{done}/{studyProblems.length} 문제 완료 · {study.memberCount}명 <ChevronRight size={12} style={{ verticalAlign: -2 }} /></span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="empty-state"><span className="empty-icon"><Users size={22} /></span><h3>첫 스터디를 만들어 보세요</h3><p>팀원을 초대하고 함께 풀 문제를 등록할 수 있어요.</p><button className="btn btn-primary" onClick={() => setCreateOpen(true)}><Plus size={15} /> 스터디 만들기</button></div>
        )}

        {upcoming > 0 && <div style={{ marginTop: 25, display: "flex", alignItems: "center", gap: 8, color: "#8b8e9e", fontSize: 11 }}><Clock3 size={14} /> 참여 중인 학습 일정이 {upcoming}개 있어요.</div>}
      </div>
      <CreateStudyModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </AppShell>
  );
}
