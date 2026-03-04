/**
 * Terminal inline image display.
 *
 * Detects terminal capabilities via environment variables and outputs
 * images using the appropriate protocol (iTerm2 OSC 1337, Kitty graphics).
 * Falls back gracefully when no protocol is available.
 */

export type ImageProtocol = "iterm2" | "kitty" | null;

/**
 * Detect which inline image protocol (if any) the current terminal supports.
 */
export function detectImageProtocol(): ImageProtocol {
  const env = process.env;

  // Kitty terminal
  if (env.KITTY_WINDOW_ID || env.TERM === "xterm-kitty") return "kitty";

  // iTerm2, WezTerm, VS Code integrated terminal — all support OSC 1337
  if (
    env.TERM_PROGRAM === "iTerm.app" ||
    env.LC_TERMINAL === "iTerm2" ||
    env.TERM_PROGRAM === "WezTerm" ||
    env.TERM_PROGRAM === "vscode"
  ) return "iterm2";

  return null;
}

/**
 * Write an image inline to stderr using the detected terminal protocol.
 * Returns true if the image was displayed, false if no protocol is available.
 */
export function displayInline(base64: string): boolean {
  const protocol = detectImageProtocol();
  if (!protocol) return false;

  switch (protocol) {
    case "iterm2":
      return displayIterm2(base64);
    case "kitty":
      return displayKitty(base64);
    default:
      return false;
  }
}

/**
 * iTerm2 inline image protocol (OSC 1337).
 * Also works in WezTerm and VS Code terminal.
 *
 * Format: ESC ] 1337 ; File=inline=1 : <base64data> BEL
 */
function displayIterm2(base64: string): boolean {
  try {
    process.stderr.write(
      `\x1b]1337;File=inline=1;size=${base64.length}:${base64}\x07\n`
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Kitty graphics protocol.
 * Sends base64 PNG data in 4096-byte chunks.
 *
 * Format: ESC _G a=T,f=100,m={0|1} ; <chunk> ESC \
 */
function displayKitty(base64: string): boolean {
  try {
    const chunkSize = 4096;
    for (let i = 0; i < base64.length; i += chunkSize) {
      const chunk = base64.slice(i, i + chunkSize);
      const isLast = i + chunkSize >= base64.length;
      const more = isLast ? 0 : 1;

      if (i === 0) {
        // First chunk: a=T (transmit+display), f=100 (PNG format)
        process.stderr.write(`\x1b_Ga=T,f=100,m=${more};${chunk}\x1b\\`);
      } else {
        process.stderr.write(`\x1b_Gm=${more};${chunk}\x1b\\`);
      }
    }
    process.stderr.write("\n");
    return true;
  } catch {
    return false;
  }
}
