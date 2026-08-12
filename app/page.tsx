import { ArrowRight, CheckCircle2, MessageCircle } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/brand";

export default function LandingPage() {
  return (
    <main className="landing">
      <nav className="landing-nav">
        <Brand />
        <div className="landing-nav-links">
          <a href="#features">기능</a>
          <a href="#workflow">사용 방법</a>
        </div>
        <div className="landing-actions">
          <Link className="btn btn-ghost" href="/login">로그인</Link>
          <Link className="btn btn-primary" href="/signup">무료로 시작하기</Link>
        </div>
      </nav>

      <section className="hero">
        <div>
          <span className="eyebrow"><span className="eyebrow-dot" /> 함께 풀면, 더 멀리 갑니다</span>
          <h1>알고리즘 스터디를<br /><em>한곳에서.</em></h1>
          <p className="hero-copy">주차별 문제 관리부터 코드 작성, 팀원 피드백까지. 흩어진 스터디 기록을 AlgoMate에서 간결하게 모아보세요.</p>
          <div className="hero-cta">
            <Link className="btn btn-primary btn-lg" href="/signup">무료로 시작하기 <ArrowRight size={17} /></Link>
            <Link className="btn btn-secondary btn-lg" href="/login?demo=1">데모 둘러보기</Link>
          </div>
          <div className="hero-note"><CheckCircle2 size={13} /> 카드 등록 없이 · 팀 인원 제한 없이 시작</div>
        </div>

        <div className="hero-visual" id="features" aria-label="AlgoMate 대시보드 미리보기">
          <div className="floating-note one"><span className="floating-icon"><MessageCircle size={15} /></span>민지가 피드백을 남겼어요</div>
          <div className="floating-note two"><span className="floating-icon"><CheckCircle2 size={15} /></span>이번 주 2문제 완료!</div>
          <div className="mock-window">
            <div className="mock-top"><i /><i /><i /></div>
            <div className="mock-body">
              <div className="mock-side">
                <div className="brand" style={{ fontSize: 12 }}><span className="brand-mark" style={{ width: 20, height: 20, borderRadius: 6 }}><span style={{ fontSize: 8 }}>&lt;/&gt;</span></span>AlgoMate</div>
                <div className="mock-side-title">MENU</div>
                <div className="mock-side-row active">⌂ &nbsp; 대시보드</div>
                <div className="mock-side-title">MY STUDY</div>
                <div className="mock-side-row">◈ &nbsp; 퇴근 후 알고리즘</div>
                <div className="mock-side-row">◇ &nbsp; 코테 합격반</div>
              </div>
              <div className="mock-main">
                <div className="mock-greeting">좋은 저녁이에요, 알고님 👋</div>
                <div className="mock-heading">오늘도 한 문제씩 성장해요.</div>
                <div className="mock-grid">
                  {[0, 1, 2, 3].map((item) => <div className="mock-card" key={item}><div className="mock-chip" /><div className="mock-line short" /><div className="mock-line" /><div className="mock-line" style={{ width: `${75 - item * 6}%` }} /></div>)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="workflow" id="workflow">
        <div className="workflow-head"><span className="eyebrow"><span className="eyebrow-dot" /> 스터디의 모든 흐름</span><h2>모이고, 풀고, 함께 리뷰해요.</h2><p>복잡한 설정 없이 팀을 만든 순간부터 학습 기록이 차곡차곡 쌓입니다.</p></div>
        <div className="workflow-grid">
          <article><span>01</span><h3>팀을 만들고 초대</h3><p>간단한 초대 코드로 팀원이 바로 참여해요.</p></article>
          <article><span>02</span><h3>주차별 문제 등록</h3><p>프로그래머스, SWEA, 백준 링크를 한곳에 모아요.</p></article>
          <article><span>03</span><h3>코드 작성과 리뷰</h3><p>자동 저장된 풀이를 즉시 공유하고 질문을 남겨요.</p></article>
        </div>
      </section>
    </main>
  );
}
