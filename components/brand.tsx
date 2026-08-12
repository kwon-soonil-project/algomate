import Link from "next/link";

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link className="brand" href={href} aria-label="AlgoMate 홈">
      <span className="brand-mark" aria-hidden="true"><span>&lt;/&gt;</span></span>
      AlgoMate
    </Link>
  );
}
