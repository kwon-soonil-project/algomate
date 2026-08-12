"use client";

import type { Study, StudyMember } from "@/lib/types";
import { useStudy } from "@/lib/study-context";
import { useToast } from "@/lib/toast-context";
import { initials } from "@/lib/utils";
import { AlertTriangle, CheckCheck, Crown, Github, Shield, Trash2, UserMinus, XCircle, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "./modal";

type MemberAction = { kind: "kick" | "transfer"; member: StudyMember };

function roleLabel(role: StudyMember["role"]) {
  return role === "owner" ? "방장" : role === "admin" ? "운영진" : "멤버";
}

export function StudyManagementModal({ study, members, currentUserId, open, onClose }: {
  study: Study;
  members: StudyMember[];
  currentUserId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { weeks, problems, githubSolutions, removeMember, transferOwnership, deleteStudy, reviewGitHubClaims, setGitHubAutoApprove } = useStudy();
  const { toast } = useToast();
  const router = useRouter();
  const [action, setAction] = useState<MemberAction | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [selectedClaimIds, setSelectedClaimIds] = useState<string[]>([]);
  const studyWeekIds = new Set(weeks.filter((item) => item.studyId === study.id).map((item) => item.id));
  const studyProblemIds = new Set(problems.filter((item) => studyWeekIds.has(item.weekId)).map((item) => item.id));
  const pendingClaims = githubSolutions.filter((item) => studyProblemIds.has(item.problemId) && item.claimStatus === "pending");

  function close() {
    if (pending) return;
    setAction(null);
    setDeleteConfirm("");
    setSelectedClaimIds([]);
    setError("");
    onClose();
  }

  async function runMemberAction() {
    if (!action) return;
    setPending(true); setError("");
    try {
      if (action.kind === "kick") {
        await removeMember(study.id, action.member.id);
        toast(`${action.member.name}님을 스터디에서 내보냈어요.`);
      } else {
        await transferOwnership(study.id, action.member.userId);
        toast(`${action.member.name}님에게 방장을 위임했어요.`);
      }
      setAction(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "팀원 정보를 변경하지 못했습니다.");
    } finally { setPending(false); }
  }

  async function runDeleteStudy() {
    if (deleteConfirm !== study.name) return;
    setPending(true); setError("");
    try {
      await deleteStudy(study.id);
      toast("스터디를 삭제했어요.");
      onClose();
      router.replace("/dashboard");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "스터디를 삭제하지 못했습니다.");
      setPending(false);
    }
  }

  async function toggleAutoApprove(enabled: boolean) {
    setPending(true); setError("");
    try {
      await setGitHubAutoApprove(study.id, enabled);
      toast(enabled ? "GitHub 소유권 요청을 자동 승인하도록 설정했어요." : "소유권 요청을 관리자 승인 방식으로 변경했어요.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "자동 승인 설정을 변경하지 못했습니다.");
    } finally { setPending(false); }
  }

  async function reviewSelectedClaims(approve: boolean) {
    if (!selectedClaimIds.length) return;
    setPending(true); setError("");
    try {
      await reviewGitHubClaims(selectedClaimIds, approve);
      toast(`${selectedClaimIds.length}개의 소유권 요청을 ${approve ? "승인" : "거절"}했어요.`);
      setSelectedClaimIds([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "소유권 요청을 처리하지 못했습니다.");
    } finally { setPending(false); }
  }

  return (
    <Modal open={open} onClose={close} title="스터디 관리" description="팀원 권한과 스터디 데이터를 관리합니다.">
      {error && <div className="error-box management-error">{error}</div>}
      <div className="management-section github-claim-management">
        <div className="management-section-head"><h3><Github size={14} /> GitHub 풀이 소유권</h3><span>{pendingClaims.length}개 대기</span></div>
        <label className="auto-approve-setting"><span className="auto-approve-icon"><Zap size={15} /></span><span><strong>소유권 요청 자동 승인</strong><small>팀원이 ‘내 풀이로 요청’을 누르면 관리자 확인 없이 즉시 연결합니다.</small></span><input type="checkbox" checked={Boolean(study.githubAutoApproveClaims)} onChange={(event) => void toggleAutoApprove(event.target.checked)} disabled={pending} /></label>
        {pendingClaims.length ? <div className="claim-request-list">
          <label className="claim-select-all"><input type="checkbox" checked={selectedClaimIds.length === pendingClaims.length} onChange={(event) => setSelectedClaimIds(event.target.checked ? pendingClaims.map((item) => item.id) : [])} /><span>전체 선택</span></label>
          {pendingClaims.map((claim) => {
            const requester = members.find((item) => item.userId === claim.claimRequestedBy);
            return <label className="claim-request-row" key={claim.id}><input type="checkbox" checked={selectedClaimIds.includes(claim.id)} onChange={(event) => setSelectedClaimIds((current) => event.target.checked ? [...new Set([...current, claim.id])] : current.filter((id) => id !== claim.id))} /><span><strong>{requester?.name ?? "팀원"}</strong><small>{claim.filePath}</small></span></label>;
          })}
          <div className="claim-bulk-actions"><button className="btn btn-primary btn-sm" type="button" disabled={pending || !selectedClaimIds.length} onClick={() => void reviewSelectedClaims(true)}><CheckCheck size={13} /> 선택 승인</button><button className="btn btn-secondary btn-sm" type="button" disabled={pending || !selectedClaimIds.length} onClick={() => void reviewSelectedClaims(false)}><XCircle size={13} /> 선택 거절</button></div>
        </div> : <p className="management-empty">현재 승인 대기 중인 소유권 요청이 없습니다.</p>}
      </div>

      <div className="management-section">
        <div className="management-section-head"><h3>팀원 관리</h3><span>{members.length}명</span></div>
        <div className="management-member-list">
          {members.map((member, index) => {
            const isMe = member.userId === currentUserId;
            const canTransfer = study.role === "owner" && !isMe;
            const canKick = !isMe && member.role !== "owner" && (study.role === "owner" || (study.role === "admin" && member.role === "member"));
            return <div className="management-member" key={member.id}>
              <span className={`avatar sm ${index % 3 === 1 ? "mint" : index % 3 === 2 ? "amber" : ""}`}>{initials(member.name)}</span>
              <span className="management-member-info"><strong>{member.name}{isMe ? " (나)" : ""}</strong><small>{member.email}</small></span>
              <span className={`management-role ${member.role}`}><Shield size={11} /> {roleLabel(member.role)}</span>
              {(canTransfer || canKick) && <span className="management-member-actions">
                {canTransfer && <button className="btn btn-ghost btn-icon btn-sm" type="button" title="방장 위임" aria-label={`${member.name}님에게 방장 위임`} onClick={() => setAction({ kind: "transfer", member })}><Crown size={14} /></button>}
                {canKick && <button className="btn btn-ghost btn-icon btn-sm danger-icon" type="button" title="강퇴" aria-label={`${member.name}님 강퇴`} onClick={() => setAction({ kind: "kick", member })}><UserMinus size={14} /></button>}
              </span>}
            </div>;
          })}
        </div>
      </div>

      {action && <div className="management-confirm">
        <AlertTriangle size={17} />
        <div><strong>{action.kind === "kick" ? `${action.member.name}님을 강퇴할까요?` : `${action.member.name}님에게 방장을 위임할까요?`}</strong><p>{action.kind === "kick" ? "해당 팀원은 더 이상 스터디를 볼 수 없습니다. 작성했던 풀이는 유지됩니다." : "위임 후 현재 방장은 운영진으로 변경됩니다."}</p></div>
        <span className="management-confirm-actions"><button className="btn btn-secondary btn-sm" type="button" onClick={() => setAction(null)} disabled={pending}>취소</button><button className="btn btn-danger btn-sm" type="button" onClick={() => void runMemberAction()} disabled={pending}>{pending ? "처리 중" : "확인"}</button></span>
      </div>}

      {study.role === "owner" && <div className="management-danger-zone">
        <div className="management-section-head"><h3><Trash2 size={14} /> 스터디 삭제</h3></div>
        <p>모든 주차, 문제, 풀이와 피드백이 영구적으로 삭제됩니다. 확인을 위해 <strong>{study.name}</strong>을 입력하세요.</p>
        <div className="management-delete-row"><input className="input" value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} placeholder={study.name} disabled={pending} /><button className="btn btn-danger" type="button" disabled={pending || deleteConfirm !== study.name} onClick={() => void runDeleteStudy()}>스터디 삭제</button></div>
      </div>}
    </Modal>
  );
}
