"use client";

import { useStudy } from "@/lib/study-context";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import { ArrowRight, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Modal } from "./modal";

export function CreateStudyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createStudy } = useStudy();
  const { toast } = useToast();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("violet");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setPending(true); setError("");
    try {
      const study = await createStudy({ name: name.trim(), description: description.trim(), color });
      toast("새 스터디를 만들었어요.");
      setName(""); setDescription(""); onClose();
      router.push(`/study/${study.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "스터디를 만들지 못했습니다.");
    } finally { setPending(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="새 스터디 만들기" description="함께 문제를 풀 팀의 공간을 만들어 보세요.">
      <form className="form" onSubmit={submit}>
        {error && <div className="error-box">{error}</div>}
        <label className="form-group">
          <span className="form-label">스터디 이름</span>
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="예: 퇴근 후 알고리즘" maxLength={40} autoFocus required />
        </label>
        <label className="form-group">
          <span className="form-label">한 줄 소개</span>
          <textarea className="textarea" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="어떤 목표로 공부하는 팀인가요?" maxLength={160} />
        </label>
        <div className="form-group">
          <span className="form-label">대표 색상</span>
          <div className="color-picker" role="radiogroup" aria-label="대표 색상">
            {["violet", "mint", "amber", "rose"].map((item) => (
              <button key={item} type="button" className={cn("color-option", item, color === item && "selected")} onClick={() => setColor(item)} role="radio" aria-checked={color === item} aria-label={item} />
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
          <button className="btn btn-primary" disabled={pending || !name.trim()}>{pending ? "만드는 중..." : <><Plus size={15} /> 스터디 만들기</>}</button>
        </div>
      </form>
    </Modal>
  );
}

export function JoinStudyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { joinStudy } = useStudy();
  const { toast } = useToast();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true); setError("");
    try {
      const study = await joinStudy(code);
      toast(`${study.name}에 참여했어요.`);
      setCode(""); onClose();
      router.push(`/study/${study.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "스터디에 참여하지 못했습니다.");
    } finally { setPending(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="초대 코드로 참여" description="팀원에게 받은 6자리 코드를 입력하세요.">
      <form className="form" onSubmit={submit}>
        {error && <div className="error-box">{error}</div>}
        <label className="form-group">
          <span className="form-label">초대 코드</span>
          <input className="input" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="예: ALGO25" maxLength={8} style={{ textTransform: "uppercase", fontFamily: "var(--font-mono)", letterSpacing: ".1em", fontWeight: 700 }} autoFocus required />
          <span className="form-hint">데모에서는 ALGO25 또는 PASS77을 사용할 수 있어요.</span>
        </label>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
          <button className="btn btn-primary" disabled={pending || code.trim().length < 4}>{pending ? "확인 중..." : <>참여하기 <ArrowRight size={15} /></>}</button>
        </div>
      </form>
    </Modal>
  );
}
