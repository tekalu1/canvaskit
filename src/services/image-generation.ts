/**
 * Image generation service — supports stock photos (Unsplash) and
 * configurable AI image generation endpoints.
 */

export interface ImageGenerationResult {
  url: string;
  width?: number;
  height?: number;
  attribution?: string;
}

export interface ImageGenerationOptions {
  type: "stock" | "ai";
  prompt: string;
  width?: number;
  height?: number;
}

/**
 * Search Unsplash for a stock photo matching the prompt.
 * Returns a direct image URL from Unsplash's source redirect.
 */
export async function fetchStockImage(
  prompt: string,
  options?: { width?: number; height?: number; accessKey?: string }
): Promise<ImageGenerationResult> {
  const width = options?.width ?? 800;
  const height = options?.height ?? 600;
  const accessKey = options?.accessKey ?? process.env.UNSPLASH_ACCESS_KEY;

  if (accessKey) {
    // Use Unsplash API if access key is available
    const url = new URL("https://api.unsplash.com/search/photos");
    url.searchParams.set("query", prompt);
    url.searchParams.set("per_page", "1");
    url.searchParams.set("orientation", width > height ? "landscape" : "portrait");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Client-ID ${accessKey}` },
    });

    if (!res.ok) {
      throw new Error(`Unsplash API error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as {
      results: Array<{
        urls: { regular: string; small: string };
        width: number;
        height: number;
        user: { name: string; links: { html: string } };
      }>;
    };

    if (data.results.length === 0) {
      throw new Error(`No stock images found for: "${prompt}"`);
    }

    const photo = data.results[0];
    return {
      url: photo.urls.regular,
      width: photo.width,
      height: photo.height,
      attribution: `Photo by ${photo.user.name} on Unsplash`,
    };
  }

  // Fallback: use Unsplash Source redirect (no API key needed)
  const url = `https://source.unsplash.com/${width}x${height}/?${encodeURIComponent(prompt)}`;
  return {
    url,
    width,
    height,
    attribution: "Photo from Unsplash",
  };
}

/**
 * Generate an AI image via a configurable endpoint.
 * Supports OpenAI-compatible APIs (DALL-E, etc.)
 */
export async function fetchAiImage(
  prompt: string,
  options?: {
    width?: number;
    height?: number;
    apiUrl?: string;
    apiKey?: string;
    model?: string;
  }
): Promise<ImageGenerationResult> {
  const apiUrl = options?.apiUrl ?? process.env.IMAGE_AI_API_URL ?? "https://api.openai.com/v1/images/generations";
  const apiKey = options?.apiKey ?? process.env.IMAGE_AI_API_KEY ?? process.env.OPENAI_API_KEY;
  const model = options?.model ?? process.env.IMAGE_AI_MODEL ?? "dall-e-3";

  if (!apiKey) {
    throw new Error(
      "No AI image API key configured. Set IMAGE_AI_API_KEY or OPENAI_API_KEY environment variable."
    );
  }

  const size = getSizeString(options?.width, options?.height);

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size,
      response_format: "url",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI image API error: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    data: Array<{ url: string; revised_prompt?: string }>;
  };

  if (!data.data || data.data.length === 0) {
    throw new Error("AI image API returned no results");
  }

  return {
    url: data.data[0].url,
    width: options?.width,
    height: options?.height,
  };
}

/**
 * Convert width/height to a size string compatible with common AI APIs.
 */
function getSizeString(width?: number, height?: number): string {
  const w = width ?? 1024;
  const h = height ?? 1024;
  return `${w}x${h}`;
}

/**
 * Generate an image (stock or AI) based on options.
 */
export async function generateImage(
  options: ImageGenerationOptions
): Promise<ImageGenerationResult> {
  if (options.type === "stock") {
    return fetchStockImage(options.prompt, {
      width: options.width,
      height: options.height,
    });
  }
  return fetchAiImage(options.prompt, {
    width: options.width,
    height: options.height,
  });
}
