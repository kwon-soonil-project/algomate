import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

function tarHeader(name: string, size: number) {
  const header = Buffer.alloc(512);
  header.write(name, 0, 100, "utf8");
  header.write("0000644\0", 100, 8, "ascii");
  header.write("0000000\0", 108, 8, "ascii");
  header.write("0000000\0", 116, 8, "ascii");
  header.write(`${size.toString(8).padStart(11, "0")}\0`, 124, 12, "ascii");
  header.write("00000000000\0", 136, 12, "ascii");
  header.fill(0x20, 148, 156);
  header[156] = "0".charCodeAt(0);
  header.write("ustar\0", 257, 6, "ascii");
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  header.write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8, "ascii");
  return header;
}

function repositoryArchive(files: Array<{ path: string; code: string }>) {
  const chunks: Buffer[] = [];
  for (const file of files) {
    const content = Buffer.from(file.code);
    chunks.push(tarHeader(`team-repo-sha/${file.path}`, content.byteLength));
    chunks.push(content);
    chunks.push(Buffer.alloc((512 - content.byteLength % 512) % 512));
  }
  chunks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(chunks));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GitHub import route", () => {
  it("loads every matching file from one repository archive", async () => {
    const archive = repositoryArchive(Array.from({ length: 205 }, (_, index) => ({
      path: `week01/swea1529/member${index}/Main.java`,
      code: `class Main${index} {}`,
    })));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(archive, { status: 200 })));

    const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "";
    try {
      const response = await POST(new NextRequest("http://localhost/api/github/import", {
        method: "POST",
        body: JSON.stringify({ repoUrl: "https://github.com/team/repo", branch: "main", rootPath: "" }),
      }));
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.entries).toHaveLength(205);
      expect(result.entries[204]).toMatchObject({ authorLabel: "member204", code: "class Main204 {}" });
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally {
      if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
      if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
    }
  });
});
