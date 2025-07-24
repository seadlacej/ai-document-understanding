import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

interface PDFAnalyzerOptions {
  model: string;
  apiKey?: string;
  temperature?: number;
}

interface VisualElements {
  hasCharts: boolean;
  hasDiagrams: boolean;
  hasImages: boolean;
  hasFlowchart: boolean;
  description: string;
}

interface PDFAnalysis {
  pageNumber: number;
  extractedText: string;
  title?: string;
  bulletPoints?: string[];
  visualElements?: VisualElements;
  language?: string;
  keyTopics?: string[];
  relationships?: string;
  error?: string;
}

interface PDFAnalysisResult {
  filename: string;
  model: string;
  text?: string;
  pages?: PDFAnalysis[];
  error?: string;
  pageCount?: number;
}

interface PDFAnalysisOptions {
  // Options for future use
}

/**
 * Gemini PDF Analyzer
 * Uses Google's Gemini 2.5 Flash model for PDF analysis
 * Extracts text and understands layout/structure
 */
export class GeminiPDFAnalyzer {
  private options: PDFAnalyzerOptions & { apiKey: string };
  private genAI: GoogleGenerativeAI;
  private fileManager: GoogleAIFileManager;

  constructor(options: PDFAnalyzerOptions = { model: "gemini-2.5-flash" }) {
    this.options = {
      apiKey: process.env.GEMINI_API_KEY || "",
      temperature: 0.1,
      ...options,
      model: options.model,
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
   */
  async analyzePDF(
    pdfPath: string,
    options: PDFAnalysisOptions = {}
  ): Promise<PDFAnalysisResult> {
    const filename = path.basename(pdfPath);
    console.log(`Analyzing PDF: ${filename}`);

    try {
      // Check file size before uploading
      const fs = await import("fs/promises");
      const stats = await fs.stat(pdfPath);
      const fileSizeMB = stats.size / (1024 * 1024);

      console.log(`PDF file size: ${fileSizeMB.toFixed(2)} MB`);

      // Gemini has a file size limit of approximately 50MB
      if (fileSizeMB > 50) {
        throw new Error(
          `PDF file is too large (${fileSizeMB.toFixed(
            2
          )} MB). Maximum supported size is 50 MB. Please compress the PDF before analysis.`
        );
      }

      if (fileSizeMB > 20) {
        console.warn(
          `PDF is ${fileSizeMB.toFixed(2)} MB - this may take longer to process`
        );
      }

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
        model: this.options.model || "gemini-2.5-flash",
        generationConfig: {
          temperature: this.options.temperature,
          topK: 1,
          topP: 1,
        },
      });

      // Analyze the PDF
      const prompt = `Analyze this entire PDF document and provide a comprehensive extraction for EACH page.

CRITICAL: Extract EVERY SINGLE word of text that appears in EACH page of the PDF. Do not summarize or skip any text.

Return ONLY a valid JSON array where each element represents one page. Do not include markdown formatting or code blocks:
[
  {
    "pageNumber": 1,
    "extractedText": "COMPLETE word-for-word transcription of ALL text in page 1",
    "title": "The page title if present",
    "bulletPoints": ["Array of bullet points if present"],
    "visualElements": {
      "hasCharts": boolean,
      "hasDiagrams": boolean,
      "hasImages": boolean,
      "hasFlowchart": boolean,
    },
    "description": "Full description of visual elements"
    "language": "detected language code (de/en/etc)",
    "keyTopics": ["Main topics discussed"],
    "relationships": "How elements relate to each other spatially"
  },
  // ... continue for each page in the PDF
]

Remember: 
- Analyze EVERY page in the PDF
- The extractedText field must contain EVERY word visible in each page
- Return ONLY the JSON array, no additional text or formatting`;

      const result = await model.generateContent([
        {
          fileData: {
            mimeType: file.mimeType,
            fileUri: file.uri,
          },
        },
        { text: prompt },
      ]);

      const response = result.response;

      const text = response.text();

      // Clean up the uploaded file
      try {
        await this.fileManager.deleteFile(file.name);
      } catch (error) {
        console.error("Failed to delete uploaded file:", error);
      }

      // Parse the JSON response
      let pages: PDFAnalysis[];
      try {
        let jsonText = text;

        // Check if the response is wrapped in markdown code blocks
        const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (codeBlockMatch) {
          jsonText = codeBlockMatch[1].trim();
        }

        // Extract JSON array from the response
        const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          pages = JSON.parse(jsonMatch[0]);
          console.log(`Parsed ${pages.length} pages from PDF`);
        } else {
          throw new Error("No JSON array found in response");
        }
      } catch (parseError) {
        console.error("Failed to parse JSON response:", parseError);
        // Fallback: treat as single page with all text
        pages = [
          {
            pageNumber: 1,
            extractedText: text,
            error: "Failed to parse structured response",
          },
        ];
      }

      // Return the result with pages array
      const resultData: PDFAnalysisResult = {
        filename,
        model: this.options.model,
        text,
        pages,
        pageCount: pages.length,
      };

      return resultData;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`Error analyzing PDF ${filename}:`, error);
      return {
        filename,
        model: this.options.model,
        error: errorMessage,
      };
    }
  }
}

export default GeminiPDFAnalyzer;
