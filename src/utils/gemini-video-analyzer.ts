import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import path from "path";
import { execSync } from "child_process";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

interface VideoAnalyzerOptions {
  apiKey?: string;
  model?: string;
  temperature?: number;
}

interface VideoScene {
  startTime: string;
  endTime: string;
  description: string;
  spokenText?: string;
}

interface VideoAnalysis {
  audioTranscription: string;
  visualDescription: string;
  scenes: VideoScene[];
  duration: number;
  language: string;
  summary?: string;
}

interface VideoAnalysisResult {
  filename: string;
  source: string;
  model: string;
  analysis: VideoAnalysis;
  error?: string;
  transcription?: string;
  description?: string;
}

interface VideoContext {
  source?: string;
  slideNumber?: number | string;
}

interface VideoInfo {
  duration: number;
  formatName?: string;
  size?: number;
  bitRate?: number;
}

/**
 * Gemini Video Analyzer
 * Uses Google's Gemini 2.5 Flash model for video analysis and transcription
 * Processes both audio and visual content
 */
export class GeminiVideoAnalyzer {
  private options: VideoAnalyzerOptions & { apiKey: string };
  private genAI: GoogleGenerativeAI;
  private fileManager: GoogleAIFileManager;
  private model: any;

  constructor(options: VideoAnalyzerOptions = {}) {
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
    this.fileManager = new GoogleAIFileManager(this.options.apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: this.options.model || "gemini-2.5-flash",
      generationConfig: {
        temperature: this.options.temperature,
      },
    });
  }

  /**
   * Analyze video using Gemini Vision
   */
  async analyzeVideo(videoPath: string, context: VideoContext = {}): Promise<VideoAnalysisResult> {
    const result: VideoAnalysisResult = {
      filename: path.basename(videoPath),
      source: context.source || "unknown",
      model: this.options.model || "gemini-2.5-flash",
      analysis: {
        audioTranscription: "",
        visualDescription: "",
        scenes: [],
        duration: 0,
        language: "",
      },
    };

    try {
      // Get video info
      const videoInfo = await this.getVideoInfo(videoPath);
      result.analysis.duration = videoInfo.duration;

      // Upload video file to Gemini
      console.log("📤 Uploading video to Gemini...");
      const uploadResult = await this.fileManager.uploadFile(videoPath, {
        mimeType: this.getMimeType(videoPath),
        displayName: path.basename(videoPath),
      });

      console.log(`✅ Video uploaded: ${uploadResult.file.displayName}`);
      console.log(`📊 File URI: ${uploadResult.file.uri}`);

      // Wait for file to be processed
      let file = uploadResult.file;
      while (file.state === "PROCESSING") {
        console.log("⏳ Waiting for video processing...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
        file = await this.fileManager.getFile(file.name);
      }

      if (file.state === "FAILED") {
        throw new Error("Video processing failed");
      }

      console.log("✅ Video ready for analysis");

      // Prepare the prompt for comprehensive video analysis
      const prompt = `Analyze this video comprehensively and provide a complete transcription of all audio content and text visible in the video.

Your response must be in the following JSON format:
{
  "audioTranscription": "Complete word-for-word transcription of ALL audio/speech in the video",
  "visualDescription": "Overall description of what happens in the video",
  "scenes": [
    {
      "startTime": "mm:ss.SSS",
      "endTime": "mm:ss.SSS",
      "description": "What happens in this scene. Explain the context, actions, and all details",
      "spokenText": "What is said during this scene"
    }
  ],
  "language": "primary language detected (e.g., 'en', 'de', 'fr')",
  "overallSummary": "Brief summary of the entire video content"
}

IMPORTANT: 
1. Transcribe EVERY word spoken in the audio - do not summarize
2. Capture ALL text that appears on screen with timestamps
3. Be as detailed and accurate as possible`;

      // Generate content with the video
      const response = await this.model.generateContent([
        prompt,
        {
          fileData: {
            fileUri: file.uri,
            mimeType: file.mimeType,
          },
        },
      ]);

      const responseText = response.response.text();

      // Parse the JSON response
      try {
        const parsed = JSON.parse(responseText);

        result.analysis.audioTranscription = parsed.audioTranscription || "";
        result.analysis.visualDescription = parsed.visualDescription || "";
        result.analysis.scenes = parsed.scenes || [];
        result.analysis.language = parsed.language || "unknown";

        // Add summary if provided
        if (parsed.overallSummary) {
          result.analysis.summary = parsed.overallSummary;
        }

        // Add properties for backwards compatibility
        result.transcription = result.analysis.audioTranscription;
        result.description = result.analysis.visualDescription;
      } catch (parseError) {
        // If JSON parsing fails, treat as plain text transcription
        console.warn("Failed to parse JSON response, using plain text");
        result.analysis.audioTranscription = responseText;
        result.analysis.visualDescription = "Raw transcription from Gemini";
        result.transcription = responseText;
        result.description = "Raw transcription from Gemini";
      }

      // Clean up uploaded file
      try {
        await this.fileManager.deleteFile(file.name);
        console.log("🧹 Cleaned up uploaded file");
      } catch (deleteError) {
        console.warn("Could not delete uploaded file:", (deleteError as Error).message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error analyzing video with Gemini: ${errorMessage}`);
      result.error = errorMessage;

      if (errorMessage.includes("API key")) {
        result.error = "Invalid or missing Gemini API key";
      } else if (errorMessage.includes("quota")) {
        result.error = "Gemini API quota exceeded";
      } else if (errorMessage.includes("size")) {
        result.error = "Video file too large for Gemini API";
      }
    }

    return result;
  }

  /**
   * Get video information using ffprobe
   */
  async getVideoInfo(videoPath: string): Promise<VideoInfo> {
    try {
      const output = execSync(
        `ffprobe -v quiet -print_format json -show_format -show_streams "${videoPath}"`,
        { encoding: "utf8" }
      );

      const info = JSON.parse(output);
      const duration = parseFloat(info.format.duration) || 0;

      return {
        duration: duration,
        formatName: info.format.format_name,
        size: parseInt(info.format.size),
        bitRate: parseInt(info.format.bit_rate),
      };
    } catch (error) {
      console.warn("Could not get video info:", (error as Error).message);
      return { duration: 0 };
    }
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".mp4": "video/mp4",
      ".avi": "video/x-msvideo",
      ".mov": "video/quicktime",
      ".wmv": "video/x-ms-wmv",
      ".flv": "video/x-flv",
      ".mkv": "video/x-matroska",
      ".webm": "video/webm",
      ".m4v": "video/x-m4v",
      ".mpg": "video/mpeg",
      ".mpeg": "video/mpeg",
    };
    return mimeTypes[ext] || "video/mp4";
  }
}

/**
 * Full video analysis
 */
export async function analyzeVideoWithGemini(videoPath: string, options: VideoAnalyzerOptions = {}): Promise<VideoAnalysisResult> {
  const analyzer = new GeminiVideoAnalyzer(options);
  return await analyzer.analyzeVideo(videoPath);
}

export default GeminiVideoAnalyzer;