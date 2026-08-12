import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { NextRequest, NextResponse } from "next/server";
import { parseGitHubRepoUrl, parseStudyTree, type GitHubTreeItem } from "../../../../lib/github-import";
import type { GitHubImportEntry } from "../../../../lib/types";

export const runtime = "nodejs";

const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;
const MAX_UNPACKED_BYTES = 150 * 1024 * 1024;
const MAX_REPOSITORY_FILES = 20_000;

function githubHeaders() {
  const result = new Headers({
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "AlgoMate-Importer",
  });
  if (process.env.GITHUB_TOKEN) result.set("Authorization", `Bearer ${process.env.GITHUB_TOKEN}`);
  return result;
}

async function readLimitedBody(response: Response, maxBytes: number) {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("저장소가 너무 큽니다. GitHub 기준 폴더를 더 좁게 구성해 주세요.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
}

function tarText(buffer: Buffer) {
  const nullIndex = buffer.indexOf(0);
  return buffer.subarray(0, nullIndex < 0 ? buffer.length : nullIndex).toString("utf8").trim();
}

function tarSize(buffer: Buffer) {
  const value = tarText(buffer).replace(/^0+/, "");
  return value ? Number.parseInt(value, 8) : 0;
}

function paxPath(buffer: Buffer) {
  const match = buffer.toString("utf8").match(/(?:^|\n)\d+ path=([^\n]+)(?:\n|$)/);
  return match?.[1];
}

function gitBlobSha(content: Buffer) {
  return createHash("sha1")
    .update(Buffer.from(`blob ${content.byteLength}\0`))
    .update(content)
    .digest("hex");
}

function unpackRepositoryArchive(archive: Buffer) {
  if (archive[0] !== 0x1f || archive[1] !== 0x8b) throw new Error("GitHub 저장소 압축 형식을 읽을 수 없습니다.");
  const tar = gunzipSync(archive, { maxOutputLength: MAX_UNPACKED_BYTES });
  const tree: GitHubTreeItem[] = [];
  const contents = new Map<string, Buffer>();
  let offset = 0;
  let nextLongPath: string | undefined;

  while (offset + 512 <= tar.byteLength) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;

    const name = tarText(header.subarray(0, 100));
    const prefix = tarText(header.subarray(345, 500));
    const size = tarSize(header.subarray(124, 136));
    const type = String.fromCharCode(header[156] || 48);
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    if (!Number.isFinite(size) || size < 0 || dataEnd > tar.byteLength) throw new Error("GitHub 저장소 압축 파일이 손상되었습니다.");

    const content = tar.subarray(dataStart, dataEnd);
    if (type === "x") nextLongPath = paxPath(content) ?? nextLongPath;
    else if (type === "L") nextLongPath = tarText(content);
    else {
      const archivePath = nextLongPath ?? (prefix ? `${prefix}/${name}` : name);
      nextLongPath = undefined;
      if (type === "0" || type === "\0") {
        const pathParts = archivePath.split("/").filter(Boolean);
        const filePath = pathParts.slice(1).join("/");
        if (filePath) {
          if (tree.length >= MAX_REPOSITORY_FILES) throw new Error("저장소 파일이 너무 많습니다. 가져오기 전용 저장소를 사용해 주세요.");
          const copiedContent = Buffer.from(content);
          tree.push({ path: filePath, type: "blob", sha: gitBlobSha(copiedContent), size: copiedContent.byteLength });
          contents.set(filePath, copiedContent);
        }
      }
    }

    offset = dataStart + Math.ceil(size / 512) * 512;
  }

  return { tree, contents };
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("YOUR_PROJECT")) {
      const authorization = request.headers.get("authorization");
      if (!authorization) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
      const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { apikey: supabaseAnonKey, Authorization: authorization },
        cache: "no-store",
      });
      if (!authResponse.ok) return NextResponse.json({ error: "로그인 세션이 만료되었습니다." }, { status: 401 });
    }

    const body = await request.json();
    const { owner, repo, url } = parseGitHubRepoUrl(String(body.repoUrl ?? ""));
    const branch = String(body.branch || "main").trim();
    const rootPath = String(body.rootPath || "").trim();

    const archiveResponse = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tarball/${encodeURIComponent(branch)}`,
      { headers: githubHeaders(), cache: "no-store", redirect: "follow" },
    );

    if (archiveResponse.status === 404) {
      return NextResponse.json({ error: "저장소나 브랜치를 찾을 수 없습니다. 비공개 저장소라면 GITHUB_TOKEN 설정도 확인해 주세요." }, { status: 404 });
    }
    if (!archiveResponse.ok) {
      const remaining = archiveResponse.headers.get("x-ratelimit-remaining");
      const message = remaining === "0"
        ? "GitHub 요청 한도를 초과했습니다. 잠시 뒤 다시 시도하거나 GITHUB_TOKEN을 설정해 주세요."
        : "GitHub 저장소를 읽지 못했습니다.";
      return NextResponse.json({ error: message }, { status: archiveResponse.status });
    }

    const archive = await readLimitedBody(archiveResponse, MAX_ARCHIVE_BYTES);
    const { tree, contents } = unpackRepositoryArchive(archive);
    const files = parseStudyTree(tree, rootPath);
    if (!files.length) {
      return NextResponse.json({ error: "week01/문제폴더/이름.java 형태의 코드 파일을 찾지 못했습니다." }, { status: 422 });
    }

    const entries: GitHubImportEntry[] = files.map((file) => ({
      ...file,
      code: contents.get(file.filePath)!.toString("utf8"),
      htmlUrl: `${url}/blob/${encodeURIComponent(branch)}/${file.filePath.split("/").map(encodeURIComponent).join("/")}`,
    }));

    return NextResponse.json({ repoUrl: url, branch, rootPath, scannedFiles: tree.length, entries });
  } catch (reason) {
    return NextResponse.json({ error: reason instanceof Error ? reason.message : "가져오기에 실패했습니다." }, { status: 400 });
  }
}
