"use client";

import { AlertTriangle } from "lucide-react";
import { Modal } from "./modal";

export function ConfirmModal({ open, title, description, confirmLabel, pending = false, onClose, onConfirm }: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <Modal open={open} onClose={pending ? () => undefined : onClose} title={title} description="삭제한 데이터는 복구할 수 없습니다.">
      <div className="confirm-warning"><AlertTriangle size={18} /><p>{description}</p></div>
      <div className="modal-actions">
        <button className="btn btn-secondary" type="button" onClick={onClose} disabled={pending}>취소</button>
        <button className="btn btn-danger" type="button" onClick={() => void onConfirm()} disabled={pending}>{pending ? "처리 중..." : confirmLabel}</button>
      </div>
    </Modal>
  );
}
