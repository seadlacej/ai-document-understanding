import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

/**
 * Gemini PDF Analyzer
 * Uses Google's Gemini 2.5 Flash model for PDF analysis
 * Extracts text and understands layout/structure
 */
export class GeminiPDFAnalyzer {
  constructor(options = {}) {
    this.options = {
      apiKey: process.env.GEMINI_API_KEY,
      model: "gemini-2.5-flash",
      temperature: 0.1,
      ...options,
    };

    if (!this.options.apiKey) {
      throw new Error(
        "Gemini API key is required. Set GEMINI_API_KEY in your .env file"
      );
    }

    this.genAI = new GoogleGenerativeAI(this.options.apiKey);
    this.fileManager = new GoogleAIFileManager(this.options.apiKey);
  }

  /**
   * Analyze a PDF file with Gemini
   * @param {string} pdfPath - Path to the PDF file
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Analysis results
   */
  async analyzePDF(pdfPath, options = {}) {
    const filename = path.basename(pdfPath);
    const slideNumber =
      options.slideNumber || filename.match(/\d+/)?.[0] || "unknown";

    console.log(`Analyzing PDF: ${filename}`);

    try {
      // Upload the PDF file
      const uploadResult = await this.fileManager.uploadFile(pdfPath, {
        mimeType: "application/pdf",
        displayName: filename,
      });

      console.log(`Uploaded ${filename} to Gemini`);

      // Wait for file to be processed
      let file = uploadResult.file;
      while (file.state === "PROCESSING") {
        console.log("Processing PDF...");
        await new Promise((resolve) => setTimeout(resolve, 5000));
        file = await this.fileManager.getFile(file.name);
      }

      if (file.state !== "ACTIVE") {
        throw new Error(`PDF processing failed with state: ${file.state}`);
      }

      // Create the model
      const model = this.genAI.getGenerativeModel({
        model: this.options.model,
        generationConfig: {
          temperature: this.options.temperature,
          topK: 1,
          topP: 1,
        },
      });

      // Analyze the PDF
      const prompt = `Analyze this PDF slide and provide a comprehensive extraction in JSON format.

CRITICAL: Extract EVERY SINGLE word of text that appears in the PDF. Do not summarize or skip any text.

Return a JSON object with:
{
  "slideNumber": ${slideNumber},
  "extractedText": "COMPLETE word-for-word transcription of ALL text in the slide",
  "title": "The slide title if present",
  "bulletPoints": ["Array of bullet points if present"],
  "visualElements": {
    "hasCharts": boolean,
    "hasDiagrams": boolean,
    "hasImages": boolean,
    "hasFlowchart": boolean,
    "description": "Full description of visual elements"
  },
  "layout": {
    "type": "title|content|titleAndContent|comparison|sectionHeader|blank|custom",
    "columns": number,
    "hasTable": boolean
  },
  "language": "detected language code (de/en/etc)",
  "keyTopics": ["Main topics discussed"],
  "relationships": "How elements relate to each other spatially"
}

Remember: The extractedText field must contain EVERY word visible in the slide.`;

      const result = await model.generateContent([
        {
          fileData: {
            mimeType: file.mimeType,
            fileUri: file.uri,
          },
        },
        { text: prompt },
      ]);

      const response = await result.response;
      const text = response.text();

      // Clean up the uploaded file
      try {
        await this.fileManager.deleteFile(file.name);
      } catch (error) {
        console.error("Failed to delete uploaded file:", error);
      }

      // Parse the JSON response
      let analysis;
      try {
        // Extract JSON from the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No JSON found in response");
        }
      } catch (parseError) {
        console.error("Failed to parse JSON response:", parseError);
        analysis = {
          slideNumber,
          extractedText: text,
          error: "Failed to parse structured response",
        };
      }

      return {
        filename,
        slideNumber,
        model: this.options.model,
        analysis,
      };
    } catch (error) {
      console.error(`Error analyzing PDF ${filename}:`, error);
      return {
        filename,
        slideNumber,
        model: this.options.model,
        error: error.message,
      };
    }
  }
}

/**
 * Helper function to analyze a PDF slide
 * @param {string} pdfPath - Path to the PDF file
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>} Analysis results
 */
export async function analyzePDFSlide(pdfPath, options = {}) {
  const analyzer = new GeminiPDFAnalyzer(options);
  return analyzer.analyzePDF(pdfPath, options);
}

export default GeminiPDFAnalyzer;
