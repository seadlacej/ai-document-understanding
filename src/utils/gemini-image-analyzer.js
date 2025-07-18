import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

/**
 * Gemini Image Analyzer
 * Uses Google's Gemini 2.5 Flash model for pure vision analysis
 * No OCR - direct image understanding through the model
 */
export class GeminiAnalyzer {
  constructor(options = {}) {
    this.options = {
      apiKey: process.env.GEMINI_API_KEY,
      model: "gemini-2.5-flash",
      temperature: 0.1,
      // maxTokens: 4000,
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
      model: this.options.model,
      generationConfig: {
        temperature: this.options.temperature,
        // maxOutputTokens: this.options.maxTokens,
      },
    });
  }

  /**
   * Analyze image using Gemini Vision
   * @param {string} imagePath - Path to image file
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeImage(imagePath, context = {}) {
    const result = {
      filename: path.basename(imagePath),
      source: context.source || "unknown",
      model: this.options.model,
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
      console.error(`Error analyzing image with Gemini: ${error.message}`);
      result.error = error.message;

      if (error.message.includes("API key")) {
        result.error = "Invalid or missing Gemini API key";
      } else if (error.message.includes("quota")) {
        result.error = "Gemini API quota exceeded";
      }
    }

    return result;
  }

  /**
   * Get MIME type from file extension
   */
  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".bmp": "image/bmp",
      ".webp": "image/webp",
    };
    return mimeTypes[ext] || "image/png";
  }

  /**
   * Batch analyze multiple images
   */
  // async analyzeImages(imagePaths, onProgress) {
  //   const results = [];

  //   for (let i = 0; i < imagePaths.length; i++) {
  //     const imagePath = imagePaths[i];
  //     const result = await this.analyzeImage(imagePath, {
  //       index: i,
  //       total: imagePaths.length,
  //     });

  //     results.push(result);

  //     if (onProgress) {
  //       onProgress(i + 1, imagePaths.length, result);
  //     }
  //   }

  //   return results;
  // }

  /**
   * Extract text only (simplified method)
   */
  // async extractText(imagePath) {
  //   const result = await this.analyzeImage(imagePath);
  //   return result.analysis.extractedText || "";
  // }
}

/**
 * Full Gemini analysis
 */
export async function analyzeWithGemini(imagePath, options = {}) {
  const analyzer = new GeminiAnalyzer(options);
  return await analyzer.analyzeImage(imagePath);
}

export default GeminiAnalyzer;
