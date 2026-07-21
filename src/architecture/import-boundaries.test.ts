import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  }).filter((path) => [".ts", ".tsx"].includes(extname(path)));
}

function imports(path: string) {
  const source = readFileSync(path, "utf8");
  return [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
}

describe("architecture import contracts", () => {
  it("keeps UI components away from repositories and server infrastructure", () => {
    const violations = sourceFiles(join(process.cwd(), "src/ui")).flatMap((path) =>
      imports(path)
        .filter((specifier) => specifier.startsWith("@/server/") || /^@\/modules\/[^/]+\/infrastructure\//.test(specifier))
        .map((specifier) => `${path.replace(process.cwd(), "")}: ${specifier}`),
    );
    expect(violations).toEqual([]);
  });

  it("keeps domain modules framework and adapter independent", () => {
    const domainRoots = readdirSync(join(process.cwd(), "src/modules"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(process.cwd(), "src/modules", entry.name, "domain"))
      .filter((path) => {
        try { return readdirSync(path).length >= 0; } catch { return false; }
      });
    const violations = domainRoots.flatMap(sourceFiles).flatMap((path) =>
      imports(path)
        .filter((specifier) => specifier === "react" || specifier.startsWith("next/") || specifier.includes("supabase") || specifier.includes("/infrastructure/"))
        .map((specifier) => `${path.replace(process.cwd(), "")}: ${specifier}`),
    );
    expect(violations).toEqual([]);
  });
});
