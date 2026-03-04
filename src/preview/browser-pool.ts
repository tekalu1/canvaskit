/**
 * Persistent Puppeteer browser pool for fast screenshot capture.
 *
 * Instead of launching/closing a browser per screenshot (~3-4s),
 * this keeps a single browser instance alive and reuses it (~500ms).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Browser = any;

export class BrowserPool {
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;

  /**
   * Acquire a connected browser instance (lazy init, auto-reconnect).
   */
  async acquire(): Promise<Browser> {
    if (this.browser?.connected) {
      return this.browser;
    }

    // Coalesce concurrent acquire() calls into a single launch
    if (this.launching) {
      return this.launching;
    }

    this.launching = this.launch();
    try {
      this.browser = await this.launching;
      return this.browser;
    } finally {
      this.launching = null;
    }
  }

  /**
   * Render HTML in a page and take a screenshot.
   */
  async screenshot(
    html: string,
    opts?: { width?: number; height?: number; format?: "png" | "jpeg" }
  ): Promise<{ base64: string; mimeType: string }> {
    const browser = await this.acquire();
    const page = await browser.newPage();
    try {
      await page.setViewport({
        width: opts?.width ?? 1440,
        height: opts?.height ?? 900,
      });
      await page.setContent(html, { waitUntil: "networkidle0" });

      const format = opts?.format ?? "png";
      const buffer = (await page.screenshot({
        type: format,
        fullPage: true,
        encoding: "binary",
      })) as Buffer;

      return {
        base64: buffer.toString("base64"),
        mimeType: `image/${format}`,
      };
    } finally {
      await page.close();
    }
  }

  /**
   * Explicitly close the browser.
   */
  async dispose(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // already closed — ignore
      }
      this.browser = null;
    }
  }

  private async launch(): Promise<Browser> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let puppeteerMod: any;
    try {
      puppeteerMod = await import("puppeteer");
    } catch {
      throw new Error(
        "Puppeteer is not installed. Run: npm install puppeteer"
      );
    }

    const launchFn = puppeteerMod.default?.launch ?? puppeteerMod.launch;
    return launchFn({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
}
