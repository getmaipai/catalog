import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bannedApiScan, BANNED_APIS } from "../src/bannedApi";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "maipai-catalog-bannedapi-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeHandler(content: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "handler.ts"), content);
}

describe("bannedApiScan", () => {
  test("eval fires", () => {
    writeHandler('export function h() { eval("1+1"); }');
    const result = bannedApiScan(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e === "banned API eval in handler.ts:1")).toBe(true);
  });

  test("Function constructor fires", () => {
    writeHandler("export function h() { return new Function('return 1')(); }");
    const result = bannedApiScan(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e === "banned API Function constructor in handler.ts:1")).toBe(true);
  });

  test("a bare fetch( fires, but host.fetch( and hostFetch( pass", () => {
    writeHandler("export function h() { fetch(url); }");
    const result = bannedApiScan(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e === "banned API direct fetch in handler.ts:1")).toBe(true);
  });

  test("host.fetch(url) and hostFetch(url) pass", () => {
    writeHandler("export function h(url) { host.fetch(url); hostFetch(url); }");
    const result = bannedApiScan(dir);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("WebSocket fires", () => {
    writeHandler("export function h() { const ws = new WebSocket('wss://x'); }");
    const result = bannedApiScan(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e === "banned API WebSocket in handler.ts:1")).toBe(true);
  });

  test("Deno.Command fires", () => {
    writeHandler("export const c = Deno.Command;");
    const result = bannedApiScan(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e === "banned API Deno.Command in handler.ts:1")).toBe(true);
  });

  test("Deno.run fires", () => {
    writeHandler("export const p = Deno.run('sh');");
    const result = bannedApiScan(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e === "banned API Deno.run in handler.ts:1")).toBe(true);
  });

  test("Deno.env fires", () => {
    writeHandler("export const e = Deno.env.get('X');");
    const result = bannedApiScan(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e === "banned API Deno.env in handler.ts:1")).toBe(true);
  });

  test("Deno.connect fires", () => {
    writeHandler("export const s = Deno.connect();");
    const result = bannedApiScan(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e === "banned API Deno.connect in handler.ts:1")).toBe(true);
  });

  test("Deno file write fires", () => {
    writeHandler("Deno.writeFile('x', new Uint8Array);");
    const result = bannedApiScan(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e === "banned API Deno file write in handler.ts:1")).toBe(true);
  });

  test("child_process fires", () => {
    writeHandler('import { spawn } from "node:child_process";');
    const result = bannedApiScan(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e === "banned API child_process in handler.ts:1")).toBe(true);
  });

  test("process.env fires", () => {
    writeHandler("export const e = process.env.X;");
    const result = bannedApiScan(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e === "banned API process.env in handler.ts:1")).toBe(true);
  });

  test("Bun runtime fires", () => {
    writeHandler("Bun.serve({});");
    const result = bannedApiScan(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e === "banned API Bun runtime in handler.ts:1")).toBe(true);
  });

  test("remote import fires", () => {
    writeHandler("import(\"https://example.com/x.js\");");
    const result = bannedApiScan(dir);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e === "banned API remote import in handler.ts:1")).toBe(true);
  });

  test("a handler_test.ts containing fetch( is not scanned", () => {
    writeFileSync(join(dir, "handler_test.ts"), "fetch(url);");
    const result = bannedApiScan(dir);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("the // banned-api: allow marker skips a line", () => {
    writeHandler("const c = Deno.Command; // banned-api: allow");
    const result = bannedApiScan(dir);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("the real plugins/info/knowledge tree passes", () => {
    const src = join(import.meta.dir, "..", "..", "plugins", "info", "knowledge");
    for (const entry of readdirSync(src)) {
      const from = join(src, entry);
      const to = join(dir, entry);
      try {
        if (statSync(from).isDirectory()) copyFileSync(from, to);
        else copyFileSync(from, to);
      } catch {
        // non-regular entries are skipped
      }
    }
    const result = bannedApiScan(dir);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("BANNED_APIS has exactly thirteen entries", () => {
    expect(BANNED_APIS.length).toBe(13);
  });
});
