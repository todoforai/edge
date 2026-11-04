import { describe, test, expect } from "bun:test";
import path from "path";
import fs from "fs";
import os from "os";
import { discoverSkills } from "./skills.js";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "skills-test-"));
}

function makeStructure(base: string, structure: Record<string, any>) {
  for (const [name, content] of Object.entries(structure)) {
    const p = path.join(base, name);
    if (content === null) {
      fs.writeFileSync(p, "");
    } else if (typeof content === "string") {
      fs.writeFileSync(p, content);
    } else {
      fs.mkdirSync(p, { recursive: true });
      makeStructure(p, content);
    }
  }
}

const validSkill = (name: string, desc: string, short?: string) => {
  const meta = short ? `\nmetadata:\n  short-description: ${short}\n` : "\n";
  return `---\nname: ${name}\ndescription: ${desc}${meta}---\n# Body\nlong content here\n`;
};

describe("discoverSkills", () => {
  test("finds SKILL.md under .agents/skills with frontmatter", async () => {
    const tmp = makeTmpDir();
    makeStructure(tmp, {
      ".agents": {
        skills: {
          formatter: { "SKILL.md": validSkill("formatter", "Formats code.") },
          linter: { "SKILL.md": validSkill("linter", "Lints code.", "Lints.") },
        },
      },
    });
    const { skills, errors } = await discoverSkills([tmp], { includeUserScope: false });
    expect(errors).toEqual([]);
    expect(skills.length).toBe(2);
    const byName = Object.fromEntries(skills.map((s) => [s.name, s]));
    expect(byName.formatter.description).toBe("Formats code.");
    expect(byName.formatter.scope).toBe("repo");
    expect(byName.formatter.path).toBe(path.join(tmp, ".agents", "skills", "formatter", "SKILL.md"));
    expect(byName.linter.shortDescription).toBe("Lints.");
    fs.rmSync(tmp, { recursive: true });
  });

  test("finds SKILL.md under .claude/skills too", async () => {
    const tmp = makeTmpDir();
    makeStructure(tmp, {
      ".claude": { skills: { fmt: { "SKILL.md": validSkill("fmt", "Formats.") } } },
    });
    const { skills, errors } = await discoverSkills([tmp], { includeUserScope: false });
    expect(errors).toEqual([]);
    expect(skills.map((s) => s.name)).toEqual(["fmt"]);
    expect(skills[0].path).toBe(path.join(tmp, ".claude", "skills", "fmt", "SKILL.md"));
    fs.rmSync(tmp, { recursive: true });
  });

  test("dedupes by name: repo .agents wins over .claude", async () => {
    const tmp = makeTmpDir();
    makeStructure(tmp, {
      ".agents": { skills: { dup: { "SKILL.md": validSkill("dup", "from agents") } } },
      ".claude": { skills: { dup: { "SKILL.md": validSkill("dup", "from claude") } } },
    });
    const { skills } = await discoverSkills([tmp], { includeUserScope: false });
    expect(skills.length).toBe(1);
    expect(skills[0].description).toBe("from agents");
    fs.rmSync(tmp, { recursive: true });
  });

  test("merges skills from .agents and .claude in the same root", async () => {
    const tmp = makeTmpDir();
    makeStructure(tmp, {
      ".agents": { skills: { a: { "SKILL.md": validSkill("a", "x") } } },
      ".claude": { skills: { b: { "SKILL.md": validSkill("b", "y") } } },
    });
    const { skills } = await discoverSkills([tmp], { includeUserScope: false });
    expect(skills.map((s) => s.name).sort()).toEqual(["a", "b"]);
    fs.rmSync(tmp, { recursive: true });
  });

  test("returns empty when .agents/skills missing", async () => {
    const tmp = makeTmpDir();
    const { skills, errors } = await discoverSkills([tmp], { includeUserScope: false });
    expect(skills).toEqual([]);
    expect(errors).toEqual([]);
    fs.rmSync(tmp, { recursive: true });
  });

  test("reports error on missing frontmatter, keeps scanning", async () => {
    const tmp = makeTmpDir();
    makeStructure(tmp, {
      ".agents": {
        skills: {
          bad: { "SKILL.md": "no frontmatter here\n" },
          good: { "SKILL.md": validSkill("good", "ok") },
        },
      },
    });
    const { skills, errors } = await discoverSkills([tmp], { includeUserScope: false });
    expect(skills.map((s) => s.name)).toEqual(["good"]);
    expect(errors.length).toBe(1);
    expect(errors[0].message).toMatch(/frontmatter/);
    fs.rmSync(tmp, { recursive: true });
  });

  test("dedupes when same root passed twice", async () => {
    const tmp = makeTmpDir();
    makeStructure(tmp, {
      ".agents": { skills: { a: { "SKILL.md": validSkill("a", "x") } } },
    });
    const { skills } = await discoverSkills([tmp, tmp], { includeUserScope: false });
    expect(skills.length).toBe(1);
    fs.rmSync(tmp, { recursive: true });
  });

  test("skips dotfiles inside skills tree", async () => {
    const tmp = makeTmpDir();
    makeStructure(tmp, {
      ".agents": {
        skills: {
          ".hidden": { "SKILL.md": validSkill("hidden", "x") },
          shown: { "SKILL.md": validSkill("shown", "x") },
        },
      },
    });
    const { skills } = await discoverSkills([tmp], { includeUserScope: false });
    expect(skills.map((s) => s.name)).toEqual(["shown"]);
    fs.rmSync(tmp, { recursive: true });
  });

  test("merges skills from multiple roots", async () => {
    const a = makeTmpDir();
    const b = makeTmpDir();
    makeStructure(a, { ".agents": { skills: { foo: { "SKILL.md": validSkill("foo", "x") } } } });
    makeStructure(b, { ".agents": { skills: { bar: { "SKILL.md": validSkill("bar", "y") } } } });
    const { skills } = await discoverSkills([a, b], { includeUserScope: false });
    expect(skills.map((s) => s.name).sort()).toEqual(["bar", "foo"]);
    fs.rmSync(a, { recursive: true });
    fs.rmSync(b, { recursive: true });
  });

  test("respects max depth (skills nested too deep are skipped)", async () => {
    const tmp = makeTmpDir();
    // 8 levels under .agents/skills/ — beyond MAX_DEPTH=6
    let nested: any = { "SKILL.md": validSkill("deep", "x") };
    for (let i = 0; i < 8; i++) nested = { [`l${i}`]: nested };
    makeStructure(tmp, {
      ".agents": {
        skills: {
          shallow: { "SKILL.md": validSkill("shallow", "x") },
          ...nested,
        },
      },
    });
    const { skills } = await discoverSkills([tmp], { includeUserScope: false });
    expect(skills.map((s) => s.name)).toEqual(["shallow"]);
    fs.rmSync(tmp, { recursive: true });
  });

  test("strips inline comments from unquoted values", async () => {
    const tmp = makeTmpDir();
    const content = "---\nname: commented # ignored\ndescription: ok # ignored\n---\n# body\n";
    makeStructure(tmp, { ".agents": { skills: { commented: { "SKILL.md": content } } } });
    const { skills, errors } = await discoverSkills([tmp], { includeUserScope: false });
    expect(errors).toEqual([]);
    expect(skills[0].name).toBe("commented");
    expect(skills[0].description).toBe("ok");
    fs.rmSync(tmp, { recursive: true });
  });

  test("parses folded (>) and literal (|) block scalar descriptions", async () => {
    const tmp = makeTmpDir();
    const folded =
      "---\nname: folded\ndescription: >\n  line one\n  line two\n\n  after blank\nmetadata:\n  short-description: short\n---\n# body\n";
    const literal = "---\nname: literal\ndescription: |\n  line one\n  line two\n---\n# body\n";
    makeStructure(tmp, {
      ".agents": {
        skills: {
          folded: { "SKILL.md": folded },
          literal: { "SKILL.md": literal },
        },
      },
    });
    const { skills, errors } = await discoverSkills([tmp], { includeUserScope: false });
    expect(errors).toEqual([]);
    const f = skills.find((s) => s.name === "folded")!;
    // sanitize() collapses whitespace, so folded/literal both end up space-joined
    expect(f.description).toBe("line one line two after blank");
    expect(f.shortDescription).toBe("short");
    const l = skills.find((s) => s.name === "literal")!;
    expect(l.description).toBe("line one line two");
    fs.rmSync(tmp, { recursive: true });
  });

  test("user-scope skill path is absolute (so read_file resolves it regardless of workspace roots)", async () => {
    const home = os.homedir();
    const skillDir = path.join(home, ".agents", "skills", "__test_user_scope__");
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), validSkill("__test_user_scope__", "x"));
    try {
      const tmp = makeTmpDir();
      const { skills } = await discoverSkills([tmp], { includeUserScope: true });
      const s = skills.find((s) => s.name === "__test_user_scope__");
      expect(s).toBeDefined();
      expect(s!.scope).toBe("user");
      expect(s!.path).toBe(path.join(skillDir, "SKILL.md"));
      fs.rmSync(tmp, { recursive: true });
    } finally {
      fs.rmSync(skillDir, { recursive: true });
    }
  });

  test("discovers plugin skills and commands under .agents/plugins", async () => {
    const tmp = makeTmpDir();
    makeStructure(tmp, {
      ".agents": {
        plugins: {
          "my-plugin": {
            ".claude-plugin": { "plugin.json": JSON.stringify({ name: "my-plugin", version: "1.0.0" }) },
            skills: { fmt: { "SKILL.md": validSkill("fmt", "Formats.") } },
            commands: { "code-review.md": "---\ndescription: Review the current diff.\n---\nReview the diff: $ARGUMENTS\n" },
          },
        },
      },
    });
    const { skills, errors } = await discoverSkills([tmp], { includeUserScope: false });
    expect(errors).toEqual([]);
    const byName = Object.fromEntries(skills.map((s) => [s.name, s]));
    expect(byName.fmt.plugin).toBe("my-plugin");
    expect(byName.fmt.kind).toBeUndefined();
    expect(byName["code-review"].kind).toBe("command");
    expect(byName["code-review"].plugin).toBe("my-plugin");
    expect(byName["code-review"].description).toBe("Review the current diff.");
    expect(byName["code-review"].path).toBe(path.join(tmp, ".agents", "plugins", "my-plugin", "commands", "code-review.md"));
    fs.rmSync(tmp, { recursive: true });
  });

  test("plugin command without frontmatter falls back to file stem", async () => {
    const tmp = makeTmpDir();
    makeStructure(tmp, {
      ".claude": { plugins: { p: { commands: { "fix-issue.md": "Fix the issue: $ARGUMENTS\n" } } } },
    });
    const { skills, errors } = await discoverSkills([tmp], { includeUserScope: false });
    expect(errors).toEqual([]);
    expect(skills.length).toBe(1);
    expect(skills[0].name).toBe("fix-issue");
    expect(skills[0].kind).toBe("command");
    expect(skills[0].plugin).toBe("p"); // no manifest → dir name
    fs.rmSync(tmp, { recursive: true });
  });

  test("plugin manifest name overrides dir name; non-md files ignored", async () => {
    const tmp = makeTmpDir();
    makeStructure(tmp, {
      ".agents": {
        plugins: {
          "dir-name": {
            ".claude-plugin": { "plugin.json": JSON.stringify({ name: "real-name" }) },
            commands: { "cmd.md": "body\n", "README.txt": "not a command\n" },
          },
        },
      },
    });
    const { skills } = await discoverSkills([tmp], { includeUserScope: false });
    expect(skills.length).toBe(1);
    expect(skills[0].plugin).toBe("real-name");
    fs.rmSync(tmp, { recursive: true });
  });

  test("plugin skill/command names dedupe first-wins against plain skills", async () => {
    const tmp = makeTmpDir();
    makeStructure(tmp, {
      ".agents": {
        skills: { dup: { "SKILL.md": validSkill("dup", "plain skill") } },
        plugins: { p: { commands: { "dup.md": "---\ndescription: plugin command\n---\nbody\n" } } },
      },
    });
    const { skills } = await discoverSkills([tmp], { includeUserScope: false });
    expect(skills.length).toBe(1);
    expect(skills[0].description).toBe("plain skill");
    fs.rmSync(tmp, { recursive: true });
  });

  test("malformed plugin.json falls back to dir name, keeps scanning", async () => {
    const tmp = makeTmpDir();
    makeStructure(tmp, {
      ".agents": {
        plugins: {
          broken: {
            ".claude-plugin": { "plugin.json": "{not json" },
            commands: { "go.md": "body\n" },
          },
        },
      },
    });
    const { skills, errors } = await discoverSkills([tmp], { includeUserScope: false });
    expect(errors).toEqual([]);
    expect(skills[0].plugin).toBe("broken");
    fs.rmSync(tmp, { recursive: true });
  });

  test("tolerates trailing whitespace on --- delimiters", async () => {
    const tmp = makeTmpDir();
    const content = "---  \nname: tol\ndescription: ok\n--- \n# body\n";
    makeStructure(tmp, { ".agents": { skills: { tol: { "SKILL.md": content } } } });
    const { skills, errors } = await discoverSkills([tmp], { includeUserScope: false });
    expect(errors).toEqual([]);
    expect(skills.map((s) => s.name)).toEqual(["tol"]);
    fs.rmSync(tmp, { recursive: true });
  });
});
