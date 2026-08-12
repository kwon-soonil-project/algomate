"use client";

import { useStudy } from "@/lib/study-context";
import { useToast } from "@/lib/toast-context";
import { useDraft } from "@/lib/use-draft";
import { FolderGit2, Github, RefreshCw, Sparkles } from "lucide-react";
import { FormEvent, useState } from "react";
import { Modal } from "./modal";

export function GitHubImportModal({ studyId, open, onClose, initialRepoUrl = "", initialBranch = "main", initialRootPath = "" }: {
  studyId: string;
  open: boolean;
  onClose: () => void;
  initialRepoUrl?: string;
  initialBranch?: string;
  initialRootPath?: string;
}) {
  const { syncGitHub } = useStudy();
  const { toast } = useToast();
  const [draft, setDraft, clearDraft] = useDraft(`algomate:draft:github-import:${studyId}`, { repoUrl: initialRepoUrl, branch: initialBranch, rootPath: initialRootPath });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function run(sample: boolean) {
    setPending(true); setError("");
    try {
      const result = await syncGitHub({
        studyId,
        repoUrl: sample ? "https://github.com/team/algostudy" : draft.repoUrl,
        branch: draft.branch || "main",
        rootPath: draft.rootPath,
        sample,
      });
      toast(`${result.weeks}개 주차에서 ${result.solutions}개 코드를 가져왔어요.`);
      clearDraft();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "GitHub 저장소를 가져오지 못했습니다.");
    } finally { setPending(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await run(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="GitHub 저장소 가져오기" description="기존 팀 저장소를 읽기 전용으로 연결합니다.">
      <form className="form" onSubmit={submit}>
        {error && <div className="error-box">{error}</div>}
        <div className="github-structure">
          <div className="github-structure-title"><FolderGit2 size={15} /> 인식하는 폴더 구조</div>
          <code>week01/swea1529/minji.java</code>
          <code>week01/swea1529/junho.java</code>
          <code>week01/swea1529/minji/Main.java</code>
          <code>week02/boj1260/minji.java</code>
        </div>
        <label className="form-group">
          <span className="form-label">저장소 주소</span>
          <input className="input" type="url" value={draft.repoUrl} onChange={(event) => setDraft((current) => ({ ...current, repoUrl: event.target.value }))} placeholder="https://github.com/team/algostudy" required />
          <span className="form-hint">공개 저장소는 URL만으로 가져옵니다. 비공개 저장소는 서버의 읽기 전용 토큰을 사용합니다.</span>
        </label>
        <div className="github-fields">
          <label className="form-group"><span className="form-label">브랜치</span><input className="input" value={draft.branch} onChange={(event) => setDraft((current) => ({ ...current, branch: event.target.value }))} placeholder="main" required /></label>
          <label className="form-group"><span className="form-label">기준 폴더 <small>선택</small></span><input className="input" value={draft.rootPath} onChange={(event) => setDraft((current) => ({ ...current, rootPath: event.target.value }))} placeholder="solutions" /></label>
        </div>
        <div className="github-info"><Github size={15} /><span>가져온 코드는 사이트에서 수정하지 않으며, 다시 동기화하면 GitHub의 최신 파일로 갱신됩니다.</span></div>
        <div className="modal-actions github-actions">
          <button type="button" className="btn btn-secondary" onClick={() => void run(true)} disabled={pending}><Sparkles size={14} /> 샘플로 확인</button>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn btn-secondary" onClick={() => { clearDraft(); onClose(); }}>취소</button>
          <button className="btn btn-primary" disabled={pending || !draft.repoUrl.trim()}>{pending ? <><RefreshCw className="spin-icon" size={14} /> 가져오는 중</> : <><Github size={15} /> 저장소 가져오기</>}</button>
        </div>
      </form>
    </Modal>
  );
}
