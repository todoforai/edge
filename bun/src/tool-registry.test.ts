import { describe, test, expect } from "bun:test";
import { findReferencedTools } from "./tool-registry.js";

describe("findReferencedTools - command position detection", () => {
  test("does NOT match tool names as loop arguments", () => {
    const r = findReferencedTools("for service in ahrefs semrush google stripe predis-ai; do\necho $service\ndone");
    expect(r).not.toContain("stripe");
  });

  test("does NOT match tool names in echo/string context", () => {
    expect(findReferencedTools("echo stripe is cool")).not.toContain("stripe");
    expect(findReferencedTools("echo gh is great")).not.toContain("gh");
    expect(findReferencedTools("echo jq is nice")).not.toContain("jq");
  });

  test("does NOT match tool names as variable values", () => {
    expect(findReferencedTools('TOOL="stripe"')).not.toContain("stripe");
    expect(findReferencedTools("name=stripe")).not.toContain("stripe");
  });

  test("matches tool at start of command", () => {
    expect(findReferencedTools("stripe login")).toContain("stripe");
    expect(findReferencedTools("gh pr list")).toContain("gh");
    expect(findReferencedTools("jq .foo file.json")).toContain("jq");
  });

  test("matches tool after pipe", () => {
    expect(findReferencedTools("curl url | jq .foo")).toContain("jq");
    expect(findReferencedTools("echo foo | stripe listen")).toContain("stripe");
  });

  test("matches tool after && and ||", () => {
    expect(findReferencedTools("cd dir && stripe deploy")).toContain("stripe");
    expect(findReferencedTools("false || gh issue list")).toContain("gh");
  });

  test("matches tool after semicolon", () => {
    expect(findReferencedTools("echo hi; stripe version")).toContain("stripe");
  });

  test("matches tool in subshell $()", () => {
    expect(findReferencedTools("echo $(stripe --version)")).toContain("stripe");
  });

  test("matches tool after sudo", () => {
    expect(findReferencedTools("sudo stripe login")).toContain("stripe");
  });

  test("matches tool after xargs", () => {
    expect(findReferencedTools("find . | xargs jq .")).toContain("jq");
  });

  test("matches tool on new line in multiline script", () => {
    const script = `echo "starting"
stripe listen --forward-to localhost:3000
echo "done"`;
    expect(findReferencedTools(script)).toContain("stripe");
  });
});
