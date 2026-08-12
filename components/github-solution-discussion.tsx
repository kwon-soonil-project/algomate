"use client";

import { useAuth } from "@/lib/auth-context";
import { useStudy } from "@/lib/study-context";
import { useToast } from "@/lib/toast-context";
import type { GitHubSolution, Study, StudyMember } from "@/lib/types";
import { initials } from "@/lib/utils";
import { Check, CircleUserRound, Clock3, MessageCircle, ShieldCheck, X } from "lucide-react";
import { FormEvent, useState } from "react";

export function GitHubSolutionDiscussion({ solution, study, members, variant = "pane" }: {
  solution: GitHubSolution;
  study: Study;
  members: StudyMember[];
  variant?: "pane" | "card";
}) {
  const { user } = useAuth();
  const { githubComments, addGitHubComment, requestGitHubClaim, reviewGitHubClaims } = useStudy();
  const { toast } = useToast();
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"feedback" | "question">("feedback");
  const [pending, setPending] = useState(false);
  const comments = githubComments.filter((item) => item.githubSolutionId === solution.id);
  const requester = members.find((item) => item.userId === solution.claimRequestedBy);
  const owner = members.find((item) => item.userId === solution.claimedBy);
  const isMine = solution.claimStatus === "approved" && solution.claimedBy === user?.id;
  const requestedByMe = solution.claimStatus === "pending" && solution.claimRequestedBy === user?.id;
  const canReview = study.role !== "member" && solution.claimStatus === "pending";

  async function requestClaim() {
    setPending(true);
    try {
      const status = await requestGitHubClaim(solution.id);
      toast(status === "approved" ? "내 GitHub 풀이로 자동 승인됐어요." : "소유권 승인을 요청했어요.");
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : "소유권을 요청하지 못했습니다.");
    } finally { setPending(false); }
  }

  async function review(approve: boolean) {
    setPending(true);
    try {
      await reviewGitHubClaims([solution.id], approve);
      toast(approve ? "소유권 요청을 승인했어요." : "소유권 요청을 거절했어요.");
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : "요청을 처리하지 못했습니다.");
    } finally { setPending(false); }
  }

  async function submitComment(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setPending(true);
    try {
      await addGitHubComment(solution.id, body.trim(), kind);
      setBody("");
      toast("GitHub 풀이에 댓글을 남겼어요.");
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : "댓글을 남기지 못했습니다.");
    } finally { setPending(false); }
  }

  return <div className={`github-discussion ${variant}`}>
    <section className="github-claim-box">
      <div className="github-discussion-heading"><CircleUserRound size={14} /><strong>풀이 소유권</strong></div>
      {solution.claimStatus === "approved" ? <div className={`claim-state approved ${isMine ? "mine" : ""}`}><ShieldCheck size={15} /><span><strong>{isMine ? "내 GitHub 풀이" : `${owner?.name ?? solution.authorLabel}님의 풀이`}</strong><small>승인된 소유권</small></span></div>
        : solution.claimStatus === "pending" ? <div className="claim-state pending"><Clock3 size={15} /><span><strong>{requestedByMe ? "내 승인 요청 대기 중" : `${requester?.name ?? "팀원"}님의 요청 대기 중`}</strong><small>방장 또는 운영진이 확인할 수 있어요.</small></span>{canReview && <span className="claim-review-actions"><button className="btn btn-primary btn-sm" type="button" disabled={pending} onClick={() => void review(true)}><Check size={12} /> 승인</button><button className="btn btn-secondary btn-sm" type="button" disabled={pending} onClick={() => void review(false)}><X size={12} /> 거절</button></span>}</div>
        : <div className="claim-state unclaimed"><span><strong>{solution.claimStatus === "rejected" && solution.claimRequestedBy === user?.id ? "이전 요청이 거절됐어요." : "아직 소유자가 없습니다."}</strong><small>{study.githubAutoApproveClaims ? "이 스터디는 요청 즉시 자동 승인됩니다." : "내가 작성한 코드라면 소유권을 요청하세요."}</small></span><button className="btn btn-secondary btn-sm" type="button" disabled={pending} onClick={() => void requestClaim()}>{pending ? "요청 중" : solution.claimStatus === "rejected" ? "다시 요청" : "내 풀이로 요청"}</button></div>}
    </section>

    <section className="github-feedback-box">
      <div className="github-discussion-heading"><MessageCircle size={14} /><strong>피드백과 질문</strong><span>{comments.length}</span></div>
      {comments.length ? <div className="comment-list">{comments.map((comment, index) => <article className="comment" key={comment.id}><span className={`avatar sm ${index % 3 === 1 ? "mint" : index % 3 === 2 ? "amber" : ""}`}>{initials(comment.userName)}</span><div className="comment-body"><div className="comment-meta"><strong>{comment.userName}</strong><span className="comment-kind">{comment.kind === "question" ? "질문" : "피드백"}</span><time>{new Date(comment.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}</time></div><p>{comment.body}</p></div></article>)}</div> : <p className="form-hint">아직 댓글이 없어요. GitHub 풀이에도 바로 의견을 남길 수 있습니다.</p>}
      <form className="github-comment-form" onSubmit={submitComment}>
        <textarea className="textarea" value={body} onChange={(event) => setBody(event.target.value)} placeholder={`${owner?.name ?? solution.authorLabel}님의 풀이에 의견을 남겨 주세요.`} />
        <div className="comment-form-actions"><div className="kind-toggle"><button type="button" className={`kind-button ${kind === "feedback" ? "active" : ""}`} onClick={() => setKind("feedback")}>피드백</button><button type="button" className={`kind-button ${kind === "question" ? "active" : ""}`} onClick={() => setKind("question")}>질문</button></div><button className="btn btn-primary btn-sm" disabled={!body.trim() || pending}><MessageCircle size={13} /> 등록</button></div>
      </form>
    </section>
  </div>;
}
