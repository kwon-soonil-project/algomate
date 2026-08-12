"use client";

import { useStudy } from "@/lib/study-context";
import { useToast } from "@/lib/toast-context";
import { CalendarPlus, Link2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { Modal } from "./modal";

export function CreateWeekModal({ studyId, open, onClose }: { studyId: string; open: boolean; onClose: () => void }) {
  const { createWeek } = useStudy();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault(); setPending(true); setError("");
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const dueDate = String(formData.get("dueDate") ?? "");
    try {
      await createWeek({ studyId, title: title.trim(), description: description.trim(), dueDate });
      toast("새 주차를 추가했어요."); setTitle(""); setDescription(""); onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "주차를 추가하지 못했습니다."); }
    finally { setPending(false); }
  }

  return <Modal open={open} onClose={onClose} title="새 주차 추가" description="이번 주의 주제와 마감일을 정해 주세요.">
    <form className="form" onSubmit={submit}>
      {error && <div className="error-box">{error}</div>}
      <label className="form-group"><span className="form-label">주차 제목</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: DFS & BFS" required autoFocus /></label>
      <label className="form-group"><span className="form-label">학습 안내</span><textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="이번 주에 집중할 내용을 적어 주세요." /></label>
      <label className="form-group"><span className="form-label">마감일</span><input className="input" name="dueDate" type="date" required /></label>
      <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>취소</button><button className="btn btn-primary" disabled={pending || !title.trim()}>{pending ? "추가 중..." : <><CalendarPlus size={15} /> 주차 추가</>}</button></div>
    </form>
  </Modal>;
}

export function CreateProblemModal({ weekId, open, onClose }: { weekId: string; open: boolean; onClose: () => void }) {
  const { createProblem } = useStudy();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [required, setRequired] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault(); setPending(true); setError("");
    try {
      await createProblem({ weekId, title: title.trim(), url: url.trim(), difficulty: difficulty.trim(), required });
      toast("문제를 등록했어요."); setTitle(""); setUrl(""); setDifficulty(""); setRequired(true); onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "문제를 등록하지 못했습니다."); }
    finally { setPending(false); }
  }

  return <Modal open={open} onClose={onClose} title="문제 등록" description="SWEA, 프로그래머스, 백준 등 문제 링크를 추가하세요.">
    <form className="form" onSubmit={submit}>
      {error && <div className="error-box">{error}</div>}
      <label className="form-group"><span className="form-label">문제 제목</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 타겟 넘버" required autoFocus /></label>
      <label className="form-group"><span className="form-label">문제 링크</span><input className="input" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." required /></label>
      <label className="form-group"><span className="form-label">난이도</span><input className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} placeholder="예: Lv.2, 실버 II" /></label>
      <label className="check-row"><input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> 필수 문제로 지정</label>
      <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>취소</button><button className="btn btn-primary" disabled={pending || !title.trim() || !url.trim()}>{pending ? "등록 중..." : <><Link2 size={15} /> 문제 등록</>}</button></div>
    </form>
  </Modal>;
}
