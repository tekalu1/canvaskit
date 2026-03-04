import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchStockImage,
  fetchAiImage,
  generateImage,
} from "../../src/services/image-generation.js";

describe("image-generation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("fetchStockImage", () => {
    it("should return an Unsplash source URL when no API key is set", async () => {
      delete process.env.UNSPLASH_ACCESS_KEY;
      const result = await fetchStockImage("modern office");
      expect(result.url).toContain("source.unsplash.com");
      expect(result.url).toContain("modern%20office");
      expect(result.attribution).toBe("Photo from Unsplash");
    });

    it("should use custom width and height", async () => {
      delete process.env.UNSPLASH_ACCESS_KEY;
      const result = await fetchStockImage("cat", { width: 400, height: 300 });
      expect(result.url).toContain("400x300");
      expect(result.width).toBe(400);
      expect(result.height).toBe(300);
    });

    it("should use Unsplash API when access key is provided", async () => {
      const mockResponse = {
        results: [
          {
            urls: { regular: "https://images.unsplash.com/photo-123", small: "" },
            width: 1920,
            height: 1080,
            user: { name: "John", links: { html: "https://unsplash.com/@john" } },
          },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchStockImage("office", {
        accessKey: "test-key",
      });
      expect(result.url).toBe("https://images.unsplash.com/photo-123");
      expect(result.attribution).toContain("John");
      expect(globalThis.fetch).toHaveBeenCalledOnce();
    });

    it("should throw on API error", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      await expect(
        fetchStockImage("office", { accessKey: "bad-key" })
      ).rejects.toThrow("Unsplash API error: 401");
    });

    it("should throw when no results found", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      await expect(
        fetchStockImage("xyznonexistent", { accessKey: "test-key" })
      ).rejects.toThrow("No stock images found");
    });
  });

  describe("fetchAiImage", () => {
    it("should throw when no API key is set", async () => {
      delete process.env.IMAGE_AI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      await expect(
        fetchAiImage("a futuristic city")
      ).rejects.toThrow("No AI image API key configured");
    });

    it("should call AI API and return URL", async () => {
      const mockResponse = {
        data: [{ url: "https://oaidalleapiprodscus.blob.core.windows.net/image-123" }],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchAiImage("a futuristic city", {
        apiKey: "test-key",
      });
      expect(result.url).toContain("image-123");
    });

    it("should throw on API error", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve("Bad request"),
      });

      await expect(
        fetchAiImage("test", { apiKey: "test-key" })
      ).rejects.toThrow("AI image API error: 400");
    });
  });

  describe("generateImage", () => {
    it("should route to stock image for type 'stock'", async () => {
      delete process.env.UNSPLASH_ACCESS_KEY;
      const result = await generateImage({
        type: "stock",
        prompt: "sunset beach",
      });
      expect(result.url).toContain("source.unsplash.com");
    });

    it("should route to AI image for type 'ai'", async () => {
      const mockResponse = {
        data: [{ url: "https://example.com/ai-image.png" }],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      process.env.IMAGE_AI_API_KEY = "test-key";
      const result = await generateImage({
        type: "ai",
        prompt: "abstract art",
      });
      expect(result.url).toBe("https://example.com/ai-image.png");
    });
  });
});
