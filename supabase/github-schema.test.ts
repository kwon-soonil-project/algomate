import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/202608120002_github_import.sql"), "utf8");

describe("GitHub import schema", () => {
  it("stores repository connection metadata and imported solutions", () => {
    expect(migration).toContain("github_repo_url");
    expect(migration).toContain("create table if not exists public.github_solutions");
    expect(migration).toContain("unique (problem_id, file_path)");
  });

  it("protects imported code with team membership policies", () => {
    expect(migration).toContain("alter table public.github_solutions enable row level security");
    expect(migration).toContain("public.is_study_member(w.study_id)");
    expect(migration).toContain("public.is_study_admin(w.study_id)");
  });
});
