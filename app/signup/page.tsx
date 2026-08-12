import { AuthForm } from "@/components/auth-form";
import { Brand } from "@/components/brand";
import { Suspense } from "react";

export default function SignupPage() {
  return (
    <main className="auth-page">
      <aside className="auth-aside">
        <Brand />
        <div className="auth-quote"><h2>혼자보다 꾸준하게,<br />함께라서 즐겁게.</h2><p>팀을 만들고 첫 문제를 등록하는 데<br />단 1분이면 충분합니다.</p></div>
        <div className="auth-steps"><span>01 팀 만들기</span><span>02 문제 등록</span><span>03 성장 기록</span></div>
      </aside>
      <section className="auth-main"><Suspense><AuthForm mode="signup" /></Suspense></section>
    </main>
  );
}
