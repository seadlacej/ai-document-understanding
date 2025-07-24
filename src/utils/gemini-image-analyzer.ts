import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import sharp from "sharp";

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
}

interface AnalysisResult {
  filename: string;
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
      apiKey: process.env.GEMINI_API_KEY || "",
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
      model: this.options.model as string,
      generationConfig: {
        temperature: this.options.temperature,
      },
    });
  }

  /**
   * Analyze image using Gemini Vision
   */
  async analyzeImage(
    imagePath: string,
    context: ImageContext = {}
  ): Promise<AnalysisResult> {
    const result: AnalysisResult = {
      filename: path.basename(imagePath),
      model: this.options.model as string,
      analysis: {
        extractedText: "",
        description: "",
      },
    };

    let processedImagePath = imagePath;
    let tempFile: string | null = null;

    try {
      // Check if the image is SVG
      if (path.extname(imagePath).toLowerCase() === ".svg") {
        // Create a temporary PNG file path
        tempFile = imagePath.replace(/\.svg$/i, "_temp.png");

        try {
          // Use sharp to convert SVG to PNG
          await sharp(imagePath)
            .png()
            .flatten({ background: { r: 255, g: 255, b: 255 } })
            .toFile(tempFile);

          processedImagePath = tempFile;
        } catch (convertError) {
          console.error("Sharp SVG conversion failed:", convertError);
          throw new Error(
            "Failed to convert SVG to PNG: " + (convertError as Error).message
          );
        }
      }

      // Read image file
      const imageData = await fs.readFile(processedImagePath);
      const base64Image = imageData.toString("base64");

      // Prepare the prompt for comprehensive text extraction
      const prompt = `Analyze this image and extract ALL text content you can see. 

Return ONLY a valid JSON object in this exact format, without any markdown formatting or code blocks:
{
  "extractedText": "Complete transcription of ALL text visible in the image.",
  "description": "Detailed description of what the image shows",
}

Important:
- Return ONLY the JSON object, no markdown code blocks, no additional text
- Focus on extracting EVERY piece of text visible in the image
- Do not summarize or paraphrase - provide exact transcription
- Ensure the response is valid JSON that can be parsed directly`;

      // Call Gemini API
      const imagePart = {
        inlineData: {
          data: base64Image,
          mimeType: this.getMimeType(processedImagePath),
        },
      };

      const response = await this.model.generateContent([
        { text: prompt },
        imagePart,
      ]);
      const responseText = response.response.text();

      // Parse the JSON response
      try {
        let jsonText = responseText;

        // Check if the response is wrapped in markdown code blocks
        const codeBlockMatch = responseText.match(
          /```(?:json)?\s*\n?([\s\S]*?)\n?```/
        );
        if (codeBlockMatch) {
          jsonText = codeBlockMatch[1].trim();
        }

        const parsed = JSON.parse(jsonText);

        result.analysis.extractedText = parsed.extractedText || "";
        result.analysis.description = parsed.description || "";
      } catch (parseError) {
        // If JSON parsing fails, treat the response as plain text
        result.analysis.extractedText = responseText;
        result.analysis.description = "Raw text extraction from Gemini";
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`Error analyzing image with Gemini: ${errorMessage}`);
      result.error = errorMessage;

      if (errorMessage.includes("API key")) {
        result.error = "Invalid or missing Gemini API key";
      } else if (errorMessage.includes("quota")) {
        result.error = "Gemini API quota exceeded";
      } else if (errorMessage.includes("Unsupported MIME type")) {
        result.error = "Unsupported image format for Gemini API";
      }
    } finally {
      // Clean up temporary file if it was created
      if (tempFile && processedImagePath === tempFile) {
        try {
          await fs.unlink(tempFile);
        } catch (e) {
          // Ignore cleanup errors
        }
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
export async function analyzeWithGemini(
  imagePath: string,
  options: AnalyzerOptions = {}
): Promise<AnalysisResult> {
  const analyzer = new GeminiImageAnalyzer(options);
  return await analyzer.analyzeImage(imagePath);
}

// Export the original class name for backwards compatibility
export { GeminiImageAnalyzer as GeminiAnalyzer };

export default GeminiImageAnalyzer;
