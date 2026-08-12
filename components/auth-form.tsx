"use client";

import { useAuth } from "@/lib/auth-context";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const { user, signIn, signUp, isDemo } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(isDemo ? "demo@algomate.kr" : "");
  const [password, setPassword] = useState(isDemo ? "demo1234" : "");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(false);

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [router, user]);

  useEffect(() => {
    if (mode === "login" && isDemo && searchParams.get("demo") === "1") {
      void signIn("demo@algomate.kr", "demo1234").then(() => router.replace("/dashboard"));
    }
  }, [isDemo, mode, router, searchParams, signIn]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true); setError("");
    try {
      if (mode === "login") {
        await signIn(email, password);
        router.replace("/dashboard");
      } else {
        const result = await signUp(name, email, password);
        if (result.needsConfirmation) setConfirmation(true);
        else router.replace("/dashboard");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "요청을 처리하지 못했습니다.");
    } finally { setPending(false); }
  }

  if (confirmation) {
    return <div className="auth-card"><h1>메일을 확인해 주세요</h1><p className="auth-sub">{email}로 인증 링크를 보냈습니다. 인증을 마치면 로그인할 수 있어요.</p><Link className="btn btn-primary auth-submit" href="/login">로그인으로 돌아가기</Link></div>;
  }

  return (
    <div className="auth-card">
      <h1>{mode === "login" ? "다시 만나 반가워요" : "함께 성장해 볼까요?"}</h1>
      <p className="auth-sub">{mode === "login" ? "내 스터디로 돌아가 오늘의 문제를 확인하세요." : "계정을 만들고 첫 번째 알고리즘 스터디를 시작하세요."}</p>
      {isDemo && <div className="demo-banner">현재 데모 모드입니다. 입력된 체험 계정으로 바로 모든 기능을 확인할 수 있어요.</div>}
      <form className="form" onSubmit={submit}>
        {error && <div className="error-box">{error}</div>}
        {mode === "signup" && <label className="form-group"><span className="form-label">이름</span><input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="팀원에게 보일 이름" required /></label>}
        <label className="form-group"><span className="form-label">이메일</span><input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required /></label>
        <label className="form-group">
          <span className="form-label">비밀번호</span>
          <span className="input-wrap">
            <input className="input" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8자 이상 입력해 주세요" minLength={8} required />
            <button className="input-action" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </span>
        </label>
        <button className="btn btn-primary btn-lg auth-submit" disabled={pending}>{pending ? "잠시만요..." : mode === "login" ? "로그인" : "무료 계정 만들기"}</button>
      </form>
      <p className="auth-switch">{mode === "login" ? <>아직 계정이 없나요? <Link href="/signup">회원가입</Link></> : <>이미 계정이 있나요? <Link href="/login">로그인</Link></>}</p>
    </div>
  );
}
