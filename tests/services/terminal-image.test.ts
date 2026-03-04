import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { detectImageProtocol, displayInline } from "../../src/services/terminal-image.js";

describe("services/terminal-image", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clean slate for each test
    delete process.env.KITTY_WINDOW_ID;
    delete process.env.TERM;
    delete process.env.TERM_PROGRAM;
    delete process.env.LC_TERMINAL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // -----------------------------------------------------------
  // detectImageProtocol
  // -----------------------------------------------------------

  describe("detectImageProtocol", () => {
    it("returns 'kitty' when KITTY_WINDOW_ID is set", () => {
      process.env.KITTY_WINDOW_ID = "1";
      expect(detectImageProtocol()).toBe("kitty");
    });

    it("returns 'kitty' when TERM is xterm-kitty", () => {
      process.env.TERM = "xterm-kitty";
      expect(detectImageProtocol()).toBe("kitty");
    });

    it("returns 'iterm2' when TERM_PROGRAM is iTerm.app", () => {
      process.env.TERM_PROGRAM = "iTerm.app";
      expect(detectImageProtocol()).toBe("iterm2");
    });

    it("returns 'iterm2' when LC_TERMINAL is iTerm2", () => {
      process.env.LC_TERMINAL = "iTerm2";
      expect(detectImageProtocol()).toBe("iterm2");
    });

    it("returns 'iterm2' when TERM_PROGRAM is WezTerm", () => {
      process.env.TERM_PROGRAM = "WezTerm";
      expect(detectImageProtocol()).toBe("iterm2");
    });

    it("returns 'iterm2' when TERM_PROGRAM is vscode", () => {
      process.env.TERM_PROGRAM = "vscode";
      expect(detectImageProtocol()).toBe("iterm2");
    });

    it("returns null for unknown terminal", () => {
      process.env.TERM_PROGRAM = "alacritty";
      expect(detectImageProtocol()).toBeNull();
    });

    it("returns null when no relevant env vars are set", () => {
      expect(detectImageProtocol()).toBeNull();
    });

    it("kitty takes priority over iterm2", () => {
      process.env.KITTY_WINDOW_ID = "1";
      process.env.TERM_PROGRAM = "iTerm.app";
      expect(detectImageProtocol()).toBe("kitty");
    });
  });

  // -----------------------------------------------------------
  // displayInline
  // -----------------------------------------------------------

  describe("displayInline", () => {
    it("returns false when no protocol is available", () => {
      expect(displayInline("AAAA")).toBe(false);
    });

    it("writes iTerm2 OSC 1337 escape sequence to stderr", () => {
      process.env.TERM_PROGRAM = "iTerm.app";
      const writeSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);

      const result = displayInline("AQID");
      expect(result).toBe(true);

      const output = writeSpy.mock.calls[0][0] as string;
      expect(output).toContain("\x1b]1337;File=inline=1;");
      expect(output).toContain("AQID");
      expect(output).toContain("\x07");

      writeSpy.mockRestore();
    });

    it("writes Kitty graphics protocol to stderr", () => {
      process.env.KITTY_WINDOW_ID = "1";
      const writeSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);

      const result = displayInline("AQID");
      expect(result).toBe(true);

      const output = writeSpy.mock.calls[0][0] as string;
      // First (and only) chunk: a=T,f=100,m=0 (last chunk)
      expect(output).toContain("\x1b_Ga=T,f=100,m=0;");
      expect(output).toContain("AQID");
      expect(output).toContain("\x1b\\");

      writeSpy.mockRestore();
    });

    it("kitty sends multi-chunk for large data", () => {
      process.env.KITTY_WINDOW_ID = "1";
      const writeSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);

      // Create data larger than 4096 bytes
      const largeBase64 = "A".repeat(5000);
      const result = displayInline(largeBase64);
      expect(result).toBe(true);

      // First chunk should have m=1 (more), second chunk m=0 (last)
      const firstChunk = writeSpy.mock.calls[0][0] as string;
      const secondChunk = writeSpy.mock.calls[1][0] as string;
      expect(firstChunk).toContain("m=1;");
      expect(secondChunk).toContain("m=0;");

      writeSpy.mockRestore();
    });
  });
});
