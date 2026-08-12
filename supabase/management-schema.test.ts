import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/202608120003_study_management.sql"), "utf8");

describe("study management schema", () => {
  it("provides atomic owner, member, and study management functions", () => {
    expect(migration).toContain("transfer_study_owner");
    expect(migration).toContain("remove_study_member");
    expect(migration).toContain("delete_owned_study");
    expect(migration).toContain("security definer");
  });

  it("limits owner transfer and protects privileged members", () => {
    expect(migration).toContain("caller_role is distinct from 'owner'");
    expect(migration).toContain("target_role = 'owner'");
    expect(migration).toContain("caller_role = 'admin' and target_role <> 'member'");
  });
});
