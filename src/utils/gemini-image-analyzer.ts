import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

interface AnalyzerOptions {
  apiKey?: string;
  model?: string;
  temperature?: number;
}

interface ImageAnalysis {
  extractedText: string;
  description: string;
  language: string;
  confidence: string;
}

interface AnalysisResult {
  filename: string;
  source: string;
  model: string;
  analysis: ImageAnalysis;
  error?: string;
}

interface ImageContext {
  source?: string;
  index?: number;
  total?: number;
  slideNumber?: number | string;
}

/**
 * Gemini Image Analyzer
 * Uses Google's Gemini 2.5 Flash model for pure vision analysis
 * No OCR - direct image understanding through the model
 */
export class GeminiImageAnalyzer {
  private options: AnalyzerOptions & { apiKey: string };
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(options: AnalyzerOptions = {}) {
    this.options = {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: "gemini-2.5-flash",
      temperature: 0.1,
      ...options,
    };

    if (!this.options.apiKey) {
      throw new Error(
        "Gemini API key is required. Set GEMINI_API_KEY in your .env file"
      );
    }

    // Initialize the Gemini client
    this.genAI = new GoogleGenerativeAI(this.options.apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: this.options.model || "gemini-2.5-flash",
      generationConfig: {
        temperature: this.options.temperature,
      },
    });
  }

  /**
   * Analyze image using Gemini Vision
   */
  async analyzeImage(imagePath: string, context: ImageContext = {}): Promise<AnalysisResult> {
    const result: AnalysisResult = {
      filename: path.basename(imagePath),
      source: context.source || "unknown",
      model: this.options.model || "gemini-2.5-flash",
      analysis: {
        extractedText: "",
        description: "",
        language: "",
        confidence: "",
      },
    };

    try {
      // Read image file
      const imageData = await fs.readFile(imagePath);
      const base64Image = imageData.toString("base64");

      // Prepare the prompt for comprehensive text extraction
      const prompt = `Analyze this image and extract ALL text content you can see. 

Your response must be in the following JSON format:
{
  "extractedText": "Complete transcription of ALL text visible in the image.",
  "description": "Detailed description of what the image shows",
  "language": "detected language (e.g., 'en', 'de', 'fr')",
  "confidence": "high|medium|low",
}

Focus on extracting EVERY piece of text visible in the image. Do not summarize or paraphrase - provide exact transcription.`;

      // Call Gemini API
      const imagePart = {
        inlineData: {
          data: base64Image,
          mimeType: this.getMimeType(imagePath),
        },
      };

      const response = await this.model.generateContent([prompt, imagePart]);
      const responseText = response.response.text();

      // Parse the JSON response
      try {
        const parsed = JSON.parse(responseText);

        result.analysis.extractedText = parsed.extractedText || "";
        result.analysis.description = parsed.description || "";
        result.analysis.language = parsed.language || "unknown";
        result.analysis.confidence = parsed.confidence || "unknown";
      } catch (parseError) {
        // If JSON parsing fails, treat the response as plain text
        console.warn("Failed to parse JSON response, using plain text");
        result.analysis.extractedText = responseText;
        result.analysis.description = "Raw text extraction from Gemini";
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error analyzing image with Gemini: ${errorMessage}`);
      result.error = errorMessage;

      if (errorMessage.includes("API key")) {
        result.error = "Invalid or missing Gemini API key";
      } else if (errorMessage.includes("quota")) {
        result.error = "Gemini API quota exceeded";
      }
    }

    return result;
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".bmp": "image/bmp",
      ".webp": "image/webp",
    };
    return mimeTypes[ext] || "image/png";
  }
}

/**
 * Full Gemini analysis
 */
export async function analyzeWithGemini(imagePath: string, options: AnalyzerOptions = {}): Promise<AnalysisResult> {
  const analyzer = new GeminiImageAnalyzer(options);
  return await analyzer.analyzeImage(imagePath);
}

// Export the original class name for backwards compatibility
export { GeminiImageAnalyzer as GeminiAnalyzer };

export default GeminiImageAnalyzer;