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
    const { skills, errors } = await discoverSkills([tmp]);
    expect(errors).toEqual([]);
    expect(skills.length).toBe(2);
    const byName = Object.fromEntries(skills.map((s) => [s.name, s]));
    expect(byName.formatter.description).toBe("Formats code.");
    expect(byName.formatter.scope).toBe("repo");
    expect(byName.formatter.path).toBe(path.join(".agents", "skills", "formatter", "SKILL.md"));
    expect(byName.linter.shortDescription).toBe("Lints.");
    fs.rmSync(tmp, { recursive: true });
  });

  test("returns empty when .agents/skills missing", async () => {
    const tmp = makeTmpDir();
    const { skills, errors } = await discoverSkills([tmp]);
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
    const { skills, errors } = await discoverSkills([tmp]);
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
    const { skills } = await discoverSkills([tmp, tmp]);
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
    const { skills } = await discoverSkills([tmp]);
    expect(skills.map((s) => s.name)).toEqual(["shown"]);
    fs.rmSync(tmp, { recursive: true });
  });

  test("merges skills from multiple roots", async () => {
    const a = makeTmpDir();
    const b = makeTmpDir();
    makeStructure(a, { ".agents": { skills: { foo: { "SKILL.md": validSkill("foo", "x") } } } });
    makeStructure(b, { ".agents": { skills: { bar: { "SKILL.md": validSkill("bar", "y") } } } });
    const { skills } = await discoverSkills([a, b]);
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
    const { skills } = await discoverSkills([tmp]);
    expect(skills.map((s) => s.name)).toEqual(["shallow"]);
    fs.rmSync(tmp, { recursive: true });
  });

  test("strips inline comments from unquoted values", async () => {
    const tmp = makeTmpDir();
    const content = "---\nname: commented # ignored\ndescription: ok # ignored\n---\n# body\n";
    makeStructure(tmp, { ".agents": { skills: { commented: { "SKILL.md": content } } } });
    const { skills, errors } = await discoverSkills([tmp]);
    expect(errors).toEqual([]);
    expect(skills[0].name).toBe("commented");
    expect(skills[0].description).toBe("ok");
    fs.rmSync(tmp, { recursive: true });
  });

  test("tolerates trailing whitespace on --- delimiters", async () => {
    const tmp = makeTmpDir();
    const content = "---  \nname: tol\ndescription: ok\n--- \n# body\n";
    makeStructure(tmp, { ".agents": { skills: { tol: { "SKILL.md": content } } } });
    const { skills, errors } = await discoverSkills([tmp]);
    expect(errors).toEqual([]);
    expect(skills.map((s) => s.name)).toEqual(["tol"]);
    fs.rmSync(tmp, { recursive: true });
  });
});
