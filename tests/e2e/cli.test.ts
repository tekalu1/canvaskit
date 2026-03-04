import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createTempDir } from "../helpers/temp-dir.js";

const execFile = promisify(execFileCb);

const CLI_PATH = resolve("dist/index.js");
const CLI_EXISTS = existsSync(CLI_PATH);

const FIXTURES_DIR = resolve("tests/fixtures");

/**
 * Run the CLI with the given arguments.
 * Returns { stdout, stderr } and never rejects (captures exit codes via stderr).
 */
async function runCli(
  args: string[],
  options?: { cwd?: string }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const result = await execFile("node", [CLI_PATH, ...args], {
      cwd: options?.cwd,
      timeout: 15_000,
    });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      exitCode: e.code ?? 1,
    };
  }
}

async function runCliWithStdin(
  args: string[],
  stdinData: string,
  options?: { cwd?: string }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const child = execFileCb("node", [CLI_PATH, ...args], {
      cwd: options?.cwd,
      timeout: 15_000,
    }, (err, stdout, stderr) => {
      resolve({
        stdout: stdout ?? "",
        stderr: stderr ?? "",
        exitCode: err ? (err as any).code ?? 1 : 0,
      });
    });
    child.stdin!.write(stdinData);
    child.stdin!.end();
  });
}

describe("CLI E2E Tests", () => {
  // Skip all tests if the project hasn't been built
  beforeAll(() => {
    if (!CLI_EXISTS) {
      console.warn(
        `Skipping CLI E2E tests: dist/index.js not found. Run "npm run build" first.`
      );
    }
  });

  let tmpDir: { path: string; cleanup: () => Promise<void> };

  beforeEach(async () => {
    tmpDir = await createTempDir();
  });

  afterEach(async () => {
    await tmpDir.cleanup();
  });

  describe.skipIf(!CLI_EXISTS)("canvaskit init", () => {
    it("should create a .canvas.json file", async () => {
      const { stdout, exitCode } = await runCli(["init", "my-design"], {
        cwd: tmpDir.path,
      });

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Created my-design.canvas.json");

      const filePath = join(tmpDir.path, "my-design.canvas.json");
      expect(existsSync(filePath)).toBe(true);

      const content = JSON.parse(await readFile(filePath, "utf-8"));
      expect(content.meta.name).toBe("my-design");
      expect(content.version).toBe("1.0.0");
      expect(content.pages.page1).toBeDefined();
    });

    it("should create a canvas from template with --template landing", async () => {
      const { stdout, exitCode } = await runCli(
        ["init", "my-landing", "--template", "landing"],
        { cwd: tmpDir.path }
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Created my-landing.canvas.json");
      expect(stdout).toContain('template "landing"');

      const filePath = join(tmpDir.path, "my-landing.canvas.json");
      expect(existsSync(filePath)).toBe(true);

      const content = JSON.parse(await readFile(filePath, "utf-8"));
      expect(content.meta.name).toBe("my-landing");
      expect(content.pages.page1.nodes.navbar).toBeDefined();
      expect(content.pages.page1.nodes.hero).toBeDefined();
      expect(content.pages.page1.nodes.features).toBeDefined();
      expect(content.pages.page1.nodes.cta).toBeDefined();
      // Has tokens
      expect(content.tokens.colors.primary).toBeDefined();
    });

    it("should list templates with --list-templates", async () => {
      const { stdout, exitCode } = await runCli(
        ["init", "--list-templates"],
        { cwd: tmpDir.path }
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("landing");
    });

    it("should fail with unknown template", async () => {
      const { stderr, exitCode } = await runCli(
        ["init", "test", "--template", "nonexistent"],
        { cwd: tmpDir.path }
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("Unknown template");
    });
  });

  describe.skipIf(!CLI_EXISTS)("canvaskit open", () => {
    it("should display a document summary", async () => {
      // Copy a valid fixture to tmp dir
      const src = join(FIXTURES_DIR, "valid-document.json");
      const dest = join(tmpDir.path, "test.canvas.json");
      await copyFile(src, dest);

      const { stdout, exitCode } = await runCli(["open", dest]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Test Canvas");
      expect(stdout).toContain("Meta");
      expect(stdout).toContain("Pages");
      expect(stdout).toContain("Home");
    });
  });

  describe.skipIf(!CLI_EXISTS)("canvaskit validate", () => {
    it("should validate a valid file and show success", async () => {
      const src = join(FIXTURES_DIR, "valid-document.json");
      const dest = join(tmpDir.path, "valid.canvas.json");
      await copyFile(src, dest);

      const { stdout, exitCode } = await runCli(["validate", dest]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("valid");
    });

    it("should detect errors in an invalid file", async () => {
      const src = join(FIXTURES_DIR, "invalid-document.json");
      const dest = join(tmpDir.path, "invalid.canvas.json");
      await copyFile(src, dest);

      const { stdout, exitCode } = await runCli(["validate", dest]);

      expect(exitCode).not.toBe(0);
      expect(stdout).toContain("invalid");
    });
  });

  describe.skipIf(!CLI_EXISTS)("canvaskit tokens", () => {
    it("should display tokens as JSON by default", async () => {
      const src = join(FIXTURES_DIR, "valid-document.json");
      const dest = join(tmpDir.path, "tokens.canvas.json");
      await copyFile(src, dest);

      const { stdout, exitCode } = await runCli(["tokens", dest]);

      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout);
      expect(parsed.colors).toBeDefined();
      expect(parsed.colors.primary.value).toBe("#3B82F6");
    });

    it("should display tokens as CSS custom properties with --format css", async () => {
      const src = join(FIXTURES_DIR, "valid-document.json");
      const dest = join(tmpDir.path, "tokens-css.canvas.json");
      await copyFile(src, dest);

      const { stdout, exitCode } = await runCli([
        "tokens",
        dest,
        "--format",
        "css",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain(":root {");
      expect(stdout).toContain("--colors-primary: #3B82F6;");
    });

    it("should display tokens as Tailwind config with --format tailwind", async () => {
      const src = join(FIXTURES_DIR, "valid-document.json");
      const dest = join(tmpDir.path, "tokens-tw.canvas.json");
      await copyFile(src, dest);

      const { stdout, exitCode } = await runCli([
        "tokens",
        dest,
        "--format",
        "tailwind",
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("@type {import('tailwindcss').Config}");
      expect(stdout).toContain('"colors"');
      expect(stdout).toContain("#3B82F6");
    });
  });

  describe.skipIf(!CLI_EXISTS)("canvaskit --help", () => {
    it("should show help text", async () => {
      const { stdout, exitCode } = await runCli(["--help"]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("canvaskit");
      expect(stdout).toContain("init");
      expect(stdout).toContain("open");
      expect(stdout).toContain("validate");
    });
  });

  describe.skipIf(!CLI_EXISTS)("canvaskit --version", () => {
    it("should show the version number", async () => {
      const { stdout, exitCode } = await runCli(["--version"]);

      expect(exitCode).toBe(0);
      expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe.skipIf(!CLI_EXISTS)("unknown command", () => {
    it("should show an error for unknown commands", async () => {
      const { stderr, exitCode } = await runCli(["nonexistent-command"]);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("error");
    });
  });

  // ── Node CLI commands ────────────────────────────────────
  describe.skipIf(!CLI_EXISTS)("canvaskit node", () => {
    let canvasFile: string;

    beforeEach(async () => {
      // Create a fresh canvas for each test
      await runCli(["init", "test"], { cwd: tmpDir.path });
      canvasFile = join(tmpDir.path, "test.canvas.json");
    });

    it("node add → node list: should add a node and list it", async () => {
      const { stdout: addOut, exitCode: addExit } = await runCli([
        "node", "add", canvasFile,
        "--page", "page1",
        "--parent", "root",
        "--type", "text",
        "--name", "Hello",
        "--content", "World",
      ]);

      expect(addExit).toBe(0);
      const addResult = JSON.parse(addOut);
      expect(addResult.created).toHaveLength(1);
      expect(addResult.created[0].name).toBe("Hello");

      const { stdout: listOut, exitCode: listExit } = await runCli([
        "node", "list", canvasFile,
        "--page", "page1",
      ]);

      expect(listExit).toBe(0);
      const listResult = JSON.parse(listOut);
      expect(listResult.nodes.some((n: { name: string }) => n.name === "Hello")).toBe(true);
    });

    it("node update → node get: should update a node", async () => {
      // Add a node first
      const { stdout: addOut } = await runCli([
        "node", "add", canvasFile,
        "--page", "page1",
        "--parent", "root",
        "--type", "text",
        "--name", "Original",
        "--content", "Before",
      ]);
      const nodeId = JSON.parse(addOut).created[0].id;

      // Update it
      const { exitCode: updateExit } = await runCli([
        "node", "update", canvasFile,
        "--page", "page1",
        "--id", nodeId,
        "--content", "After",
      ]);
      expect(updateExit).toBe(0);

      // Verify with get
      const { stdout: getOut, exitCode: getExit } = await runCli([
        "node", "get", canvasFile,
        "--page", "page1",
        "--id", nodeId,
      ]);
      expect(getExit).toBe(0);
      const getResult = JSON.parse(getOut);
      expect(getResult.content).toBe("After");
    });

    it("node delete: should remove a node", async () => {
      // Add a node first
      const { stdout: addOut } = await runCli([
        "node", "add", canvasFile,
        "--page", "page1",
        "--parent", "root",
        "--type", "text",
        "--name", "ToDelete",
        "--content", "Bye",
      ]);
      const nodeId = JSON.parse(addOut).created[0].id;

      // Delete it
      const { exitCode: delExit } = await runCli([
        "node", "delete", canvasFile,
        "--page", "page1",
        "--id", nodeId,
      ]);
      expect(delExit).toBe(0);

      // Verify it's gone
      const content = JSON.parse(await readFile(canvasFile, "utf-8"));
      expect(content.pages.page1.nodes[nodeId]).toBeUndefined();
    });

    it("node move: should change a node's parent", async () => {
      // Add a container frame
      const { stdout: frameOut } = await runCli([
        "node", "add", canvasFile,
        "--page", "page1",
        "--parent", "root",
        "--type", "frame",
        "--name", "Container",
      ]);
      const frameId = JSON.parse(frameOut).created[0].id;

      // Add a text node under root
      const { stdout: textOut } = await runCli([
        "node", "add", canvasFile,
        "--page", "page1",
        "--parent", "root",
        "--type", "text",
        "--name", "Moveable",
        "--content", "Move me",
      ]);
      const textId = JSON.parse(textOut).created[0].id;

      // Move text node into the container
      const { exitCode: moveExit } = await runCli([
        "node", "move", canvasFile,
        "--page", "page1",
        "--id", textId,
        "--to", frameId,
      ]);
      expect(moveExit).toBe(0);

      // Verify the parent changed
      const content = JSON.parse(await readFile(canvasFile, "utf-8"));
      expect(content.pages.page1.nodes[frameId].children).toContain(textId);
      expect(content.pages.page1.nodes.root.children).not.toContain(textId);
    });

    it("node add --tree: should create nested nodes from tree JSON", async () => {
      const tree = JSON.stringify({
        type: "frame",
        name: "Hero",
        children: [
          { type: "text", name: "Title", content: "Hello World" },
          { type: "text", name: "Subtitle", content: "Welcome" },
        ],
      });

      const { stdout: addOut, exitCode: addExit } = await runCliWithStdin(
        ["node", "add", canvasFile, "--page", "page1", "--parent", "root", "--tree"],
        tree,
        { cwd: tmpDir.path }
      );

      expect(addExit).toBe(0);
      const addResult = JSON.parse(addOut);
      expect(addResult.created).toHaveLength(3);
      expect(addResult.created.map((n: { name: string }) => n.name)).toContain("Hero");
      expect(addResult.created.map((n: { name: string }) => n.name)).toContain("Title");
      expect(addResult.created.map((n: { name: string }) => n.name)).toContain("Subtitle");

      // Verify nodes exist in the file
      const { stdout: listOut } = await runCli([
        "node", "list", canvasFile, "--page", "page1",
      ]);
      const listResult = JSON.parse(listOut);
      expect(listResult.nodes.some((n: { name: string }) => n.name === "Hero")).toBe(true);
      expect(listResult.nodes.some((n: { name: string }) => n.name === "Title")).toBe(true);
    });

    it("node add --tree-file: should create nested nodes from a JSON file", async () => {
      const tree = {
        type: "frame",
        name: "Section",
        children: [
          { type: "text", name: "Heading", content: "From File" },
          { type: "text", name: "Body", content: "Content & more" },
        ],
      };
      const treeFilePath = join(tmpDir.path, "tree.json");
      await writeFile(treeFilePath, JSON.stringify(tree), "utf-8");

      const { stdout: addOut, exitCode: addExit } = await runCli([
        "node", "add", canvasFile,
        "--page", "page1",
        "--parent", "root",
        "--tree-file", treeFilePath,
      ]);

      expect(addExit).toBe(0);
      const addResult = JSON.parse(addOut);
      expect(addResult.created).toHaveLength(3);
      expect(addResult.created.map((n: { name: string }) => n.name)).toContain("Section");
      expect(addResult.created.map((n: { name: string }) => n.name)).toContain("Heading");
      expect(addResult.created.map((n: { name: string }) => n.name)).toContain("Body");
    });

    it("node add --tree-file: should handle array of root nodes", async () => {
      const trees = [
        { type: "text", name: "First", content: "A" },
        { type: "text", name: "Second", content: "B" },
      ];
      const treeFilePath = join(tmpDir.path, "trees.json");
      await writeFile(treeFilePath, JSON.stringify(trees), "utf-8");

      const { stdout: addOut, exitCode: addExit } = await runCli([
        "node", "add", canvasFile,
        "--page", "page1",
        "--parent", "root",
        "--tree-file", treeFilePath,
      ]);

      expect(addExit).toBe(0);
      const addResult = JSON.parse(addOut);
      expect(addResult.created).toHaveLength(2);
      expect(addResult.created.map((n: { name: string }) => n.name)).toContain("First");
      expect(addResult.created.map((n: { name: string }) => n.name)).toContain("Second");
    });

    it("node add --tree: should handle array of root nodes via stdin", async () => {
      const trees = JSON.stringify([
        { type: "text", name: "SibA", content: "1" },
        { type: "text", name: "SibB", content: "2" },
      ]);

      const { stdout: addOut, exitCode: addExit } = await runCliWithStdin(
        ["node", "add", canvasFile, "--page", "page1", "--parent", "root", "--tree"],
        trees,
        { cwd: tmpDir.path }
      );

      expect(addExit).toBe(0);
      const addResult = JSON.parse(addOut);
      expect(addResult.created).toHaveLength(2);
      expect(addResult.created.map((n: { name: string }) => n.name)).toContain("SibA");
      expect(addResult.created.map((n: { name: string }) => n.name)).toContain("SibB");
    });

    it("node add --parent-name: should add a node by parent name", async () => {
      // First add a frame container
      await runCli([
        "node", "add", canvasFile,
        "--page", "page1",
        "--parent", "root",
        "--type", "frame",
        "--name", "MySection",
      ]);

      // Now add a child using parent name
      const { stdout: addOut, exitCode: addExit } = await runCli([
        "node", "add", canvasFile,
        "--page", "page1",
        "--parent-name", "MySection",
        "--type", "text",
        "--name", "SectionTitle",
        "--content", "Welcome",
      ]);

      expect(addExit).toBe(0);
      const addResult = JSON.parse(addOut);
      expect(addResult.created).toHaveLength(1);
      expect(addResult.created[0].name).toBe("SectionTitle");

      // Verify it's under MySection
      const content = JSON.parse(await readFile(canvasFile, "utf-8"));
      const sectionId = Object.entries(content.pages.page1.nodes).find(
        ([, n]: [string, any]) => n.name === "MySection"
      )?.[0];
      expect(content.pages.page1.nodes[sectionId!].children).toContain(
        addResult.created[0].id
      );
    });

    it("node list --type: should filter by type", async () => {
      // Add nodes of different types
      await runCli([
        "node", "add", canvasFile,
        "--page", "page1",
        "--parent", "root",
        "--type", "text",
        "--name", "TextNode",
        "--content", "hi",
      ]);
      await runCli([
        "node", "add", canvasFile,
        "--page", "page1",
        "--parent", "root",
        "--type", "frame",
        "--name", "FrameNode",
      ]);

      const { stdout, exitCode } = await runCli([
        "node", "list", canvasFile,
        "--page", "page1",
        "--type", "text",
      ]);
      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.nodes.every((n: { type: string }) => n.type === "text")).toBe(true);
      expect(result.nodes.some((n: { name: string }) => n.name === "TextNode")).toBe(true);
    });

    it("node update --style: should update styles via key=value pairs", async () => {
      // Add a text node first
      const { stdout: addOut } = await runCli([
        "node", "add", canvasFile,
        "--page", "page1",
        "--parent", "root",
        "--type", "text",
        "--name", "Styled",
        "--content", "Hello",
      ]);
      const nodeId = JSON.parse(addOut).created[0].id;

      // Update with --style flags
      const { exitCode: updateExit } = await runCli([
        "node", "update", canvasFile,
        "--page", "page1",
        "--id", nodeId,
        "--style", "color=#e53e3e",
        "--style", "fontSize=22",
      ]);
      expect(updateExit).toBe(0);

      // Verify styles were applied
      const { stdout: getOut } = await runCli([
        "node", "get", canvasFile,
        "--page", "page1",
        "--id", nodeId,
      ]);
      const node = JSON.parse(getOut);
      expect(node.styles.color).toBe("#e53e3e");
      expect(node.styles.fontSize).toBe(22);
    });

    it("node update --stdin: should accept a single object (not just array)", async () => {
      // Add a text node first
      const { stdout: addOut } = await runCli([
        "node", "add", canvasFile,
        "--page", "page1",
        "--parent", "root",
        "--type", "text",
        "--name", "SingleObj",
        "--content", "Before",
      ]);
      const nodeId = JSON.parse(addOut).created[0].id;

      // Update with single object via stdin
      const singleObj = JSON.stringify({ id: nodeId, content: "After Single" });
      const { exitCode, stdout } = await runCliWithStdin(
        ["node", "update", canvasFile, "--page", "page1", "--stdin"],
        singleObj,
        { cwd: tmpDir.path }
      );
      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.updated).toHaveLength(1);

      // Verify update
      const { stdout: getOut } = await runCli([
        "node", "get", canvasFile,
        "--page", "page1",
        "--id", nodeId,
      ]);
      expect(JSON.parse(getOut).content).toBe("After Single");
    });

    it("node add --stdin: should accept a single object (not just array)", async () => {
      const singleNode = JSON.stringify({
        type: "text",
        name: "SingleAdd",
        content: "Added via single object",
      });
      const { exitCode, stdout } = await runCliWithStdin(
        ["node", "add", canvasFile, "--page", "page1", "--parent", "root", "--stdin"],
        singleNode,
        { cwd: tmpDir.path }
      );
      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.created).toHaveLength(1);
      expect(result.created[0].name).toBe("SingleAdd");
    });
  });

  // ── Token CLI commands ───────────────────────────────────
  describe.skipIf(!CLI_EXISTS)("canvaskit token", () => {
    let canvasFile: string;

    beforeEach(async () => {
      await runCli(["init", "test"], { cwd: tmpDir.path });
      canvasFile = join(tmpDir.path, "test.canvas.json");
    });

    it("token set → token get: should set and retrieve a token", async () => {
      const { exitCode: setExit } = await runCli([
        "token", "set", canvasFile,
        "--category", "colors",
        "--key", "primary",
        "--value", "#FF0000",
      ]);
      expect(setExit).toBe(0);

      const { stdout: getOut, exitCode: getExit } = await runCli([
        "token", "get", canvasFile,
        "--category", "colors",
        "--key", "primary",
      ]);
      expect(getExit).toBe(0);
      const result = JSON.parse(getOut);
      expect(result.value).toBe("#FF0000");
    });

    it("token delete: should remove a token", async () => {
      // Set a token first
      await runCli([
        "token", "set", canvasFile,
        "--category", "spacing",
        "--key", "sm",
        "--value", "8px",
      ]);

      // Delete it
      const { exitCode: delExit } = await runCli([
        "token", "delete", canvasFile,
        "--category", "spacing",
        "--key", "sm",
      ]);
      expect(delExit).toBe(0);

      // Verify it's gone
      const { exitCode: getExit } = await runCli([
        "token", "get", canvasFile,
        "--category", "spacing",
        "--key", "sm",
      ]);
      expect(getExit).not.toBe(0);
    });

    it("token set with --description: should store description", async () => {
      await runCli([
        "token", "set", canvasFile,
        "--category", "colors",
        "--key", "brand",
        "--value", "#00FF00",
        "--description", "Brand green",
      ]);

      const { stdout } = await runCli([
        "token", "get", canvasFile,
        "--category", "colors",
        "--key", "brand",
      ]);
      const result = JSON.parse(stdout);
      expect(result.value).toBe("#00FF00");
      expect(result.description).toBe("Brand green");
    });
  });

  // ── Component CLI commands ───────────────────────────────
  describe.skipIf(!CLI_EXISTS)("canvaskit component", () => {
    let canvasFile: string;

    beforeEach(async () => {
      await runCli(["init", "test"], { cwd: tmpDir.path });
      canvasFile = join(tmpDir.path, "test.canvas.json");
    });

    it("component create → component list: should create and list", async () => {
      const { exitCode: createExit } = await runCli([
        "component", "create", canvasFile,
        "--name", "Button",
        "--description", "A button component",
      ]);
      expect(createExit).toBe(0);

      const { stdout: listOut, exitCode: listExit } = await runCli([
        "component", "list", canvasFile,
      ]);
      expect(listExit).toBe(0);
      const result = JSON.parse(listOut);
      expect(result.components.some((c: { name: string }) => c.name === "Button")).toBe(true);
    });

    it("component list: should show empty list on new canvas", async () => {
      const { stdout, exitCode } = await runCli([
        "component", "list", canvasFile,
      ]);
      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.count).toBe(0);
      expect(result.components).toEqual([]);
    });
  });
});
