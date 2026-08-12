import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const schema = readFileSync(resolve(process.cwd(), "supabase/migrations/202608120001_initial_schema.sql"), "utf8");

describe("Supabase security schema", () => {
  it("enables RLS on every user-data table", () => {
    for (const table of ["profiles", "studies", "study_members", "study_weeks", "problems", "submissions", "comments"]) {
      expect(schema).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("limits submission writes to the author", () => {
    expect(schema).toContain('create policy "submissions_insert_self"');
    expect(schema).toContain('create policy "submissions_update_self"');
    expect(schema).toContain("user_id = auth.uid()");
  });

  it("provides safe study creation and invite join functions", () => {
    expect(schema).toContain("create_study_with_owner");
    expect(schema).toContain("join_study_by_code");
    expect(schema).toContain("security definer");
  });
});
