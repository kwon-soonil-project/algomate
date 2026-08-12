"use client";

import { Brand } from "./brand";
import { useAuth } from "@/lib/auth-context";
import { useStudy } from "@/lib/study-context";
import { initials } from "@/lib/utils";
import { BookOpen, Home, LogOut, Menu, Plus, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { CreateStudyModal, JoinStudyModal } from "./study-modals";

export function AppShell({ children, breadcrumb }: { children: React.ReactNode; breadcrumb?: React.ReactNode }) {
  const { user, signOut, isDemo } = useAuth();
  const { studies } = useStudy();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  return (
    <div className="app-layout">
      {sidebarOpen && <button className="mobile-overlay" aria-label="사이드바 닫기" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <Brand href="/dashboard" />
        <nav className="sidebar-nav" aria-label="주요 메뉴">
          <Link className={`sidebar-link ${pathname === "/dashboard" ? "active" : ""}`} href="/dashboard" onClick={() => setSidebarOpen(false)}>
            <Home size={16} /> 대시보드
          </Link>
          <button className="sidebar-link sidebar-add" onClick={() => setJoinOpen(true)}>
            <Users size={16} /> 초대 코드로 참여
          </button>
        </nav>

        <div className="sidebar-section">
          <div className="sidebar-label">
            <span>내 스터디</span>
            <button className="btn btn-ghost btn-icon" style={{ width: 24, minHeight: 24 }} aria-label="스터디 만들기" onClick={() => setCreateOpen(true)}><Plus size={14} /></button>
          </div>
          <nav className="sidebar-nav" aria-label="내 스터디">
            {studies.map((study) => (
              <Link key={study.id} className={`sidebar-link ${pathname.startsWith(`/study/${study.id}`) ? "active" : ""}`} href={`/study/${study.id}`} onClick={() => setSidebarOpen(false)}>
                <span className={`study-dot ${study.color}`}>{initials(study.name)}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{study.name}</span>
              </Link>
            ))}
            {!studies.length && <span className="sidebar-link" style={{ fontSize: 11, color: "#706e7e" }}><BookOpen size={15} /> 아직 스터디가 없어요</span>}
          </nav>
        </div>

        <div className="sidebar-spacer" />
        <div className="user-menu">
          <button className="user-menu-button" onClick={handleSignOut} title="로그아웃">
            <span className="avatar">{initials(user?.name ?? "U")}</span>
            <span className="user-meta">
              <span className="user-name">{user?.name}</span>
              <span className="user-email">{user?.email}</span>
            </span>
            {isDemo ? <span className="demo-pill">DEMO</span> : <LogOut size={14} />}
          </button>
        </div>
      </aside>

      <main className="app-main">
        <header className="mobile-header">
          <button className="btn btn-ghost btn-icon" onClick={() => setSidebarOpen(true)} aria-label="메뉴 열기"><Menu size={20} /></button>
          <Brand href="/dashboard" />
          <button className="btn btn-ghost btn-icon" aria-label="메뉴 닫기" style={{ visibility: "hidden" }}><X size={20} /></button>
        </header>
        <header className="topbar">
          <div className="breadcrumb">{breadcrumb ?? <><Home size={14} /><strong>대시보드</strong></>}</div>
          <div className="topbar-actions">
            {isDemo && <span className="demo-pill">데모 모드</span>}
            <button className="btn btn-secondary btn-sm" onClick={() => setJoinOpen(true)}>초대 코드 입력</button>
            <button className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}><Plus size={14} /> 새 스터디</button>
          </div>
        </header>
        {children}
      </main>

      <CreateStudyModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <JoinStudyModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </div>
  );
}
