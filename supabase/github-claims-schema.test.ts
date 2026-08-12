import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/202608130001_github_claims_and_feedback.sql"), "utf8");

describe("GitHub claims and feedback schema", () => {
  it("stores claim state and GitHub solution comments", () => {
    expect(migration).toContain("github_auto_approve_claims");
    expect(migration).toContain("claim_requested_by");
    expect(migration).toContain("create table if not exists public.github_solution_comments");
    expect(migration).toContain("on delete cascade");
  });

  it("provides request, bulk review, and automatic approval RPCs", () => {
    expect(migration).toContain("request_github_solution_claim");
    expect(migration).toContain("review_github_solution_claims");
    expect(migration).toContain("set_github_claim_auto_approve");
    expect(migration).toContain("public.is_study_admin(w.study_id)");
  });
});
