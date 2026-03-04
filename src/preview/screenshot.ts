import type { Document } from "../core/document.js";
import { exportToHtml } from "../tools/export-tools.js";

export interface ScreenshotOptions {
  format?: "png" | "jpeg";
  width?: number;
  height?: number;
  quality?: number;
  fullPage?: boolean;
}

export interface ScreenshotResult {
  buffer: Buffer;
  width: number;
  height: number;
  format: "png" | "jpeg";
  base64: string;
}

/**
 * Take a screenshot of a canvas page or subtree using Puppeteer.
 *
 * Puppeteer is dynamically imported to keep it optional —
 * users who only need the preview server don't need Chrome installed.
 */
export async function takeScreenshot(
  doc: Document,
  pageId: string,
  nodeId?: string,
  options?: ScreenshotOptions
): Promise<ScreenshotResult> {
  const format = options?.format ?? "png";
  const width = options?.width ?? 1440;
  const height = options?.height ?? 900;

  // Generate HTML
  const html = exportToHtml(doc, pageId, nodeId);

  // Dynamic import of puppeteer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let puppeteerMod: any;
  try {
    puppeteerMod = await import("puppeteer");
  } catch {
    throw new Error(
      "Puppeteer is not installed. Run: npm install puppeteer"
    );
  }

  const launch = puppeteerMod.default?.launch ?? puppeteerMod.launch;
  const browser = await launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.setContent(html, { waitUntil: "networkidle0" });

    const screenshotOptions: Record<string, unknown> = {
      type: format,
      fullPage: options?.fullPage ?? true,
      encoding: "binary",
    };

    if (format === "jpeg" && options?.quality) {
      screenshotOptions.quality = options.quality;
    }

    const buffer = (await page.screenshot(screenshotOptions)) as Buffer;

    // Get actual rendered dimensions (runs in browser context)
    const dimensions = await page.evaluate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => {
        const de = (globalThis as any).document.documentElement;
        return {
          width: de.scrollWidth as number,
          height: de.scrollHeight as number,
        };
      }
    );

    return {
      buffer,
      width: dimensions.width,
      height: dimensions.height,
      format,
      base64: buffer.toString("base64"),
    };
  } finally {
    await browser.close();
  }
}
