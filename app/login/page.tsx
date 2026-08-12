import { AuthForm } from "@/components/auth-form";
import { Brand } from "@/components/brand";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <aside className="auth-aside">
        <Brand />
        <div className="auth-quote"><h2>좋은 풀이는<br />함께 볼 때 완성돼요.</h2><p>코드를 기록하고, 서로의 생각을 나누며<br />꾸준히 성장하는 스터디를 만들어 보세요.</p></div>
        <div className="auth-steps"><span>01 문제 선택</span><span>02 코드 작성</span><span>03 함께 리뷰</span></div>
      </aside>
      <section className="auth-main"><Suspense><AuthForm mode="login" /></Suspense></section>
    </main>
  );
}
