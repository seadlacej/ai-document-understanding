import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import path from "path";
import { execSync } from "child_process";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

/**
 * Gemini Video Analyzer
 * Uses Google's Gemini 2.0 Flash model for video analysis and transcription
 * Processes both audio and visual content
 */
export class GeminiVideoAnalyzer {
  constructor(options = {}) {
    this.options = {
      apiKey: process.env.GEMINI_API_KEY,
      model: "gemini-2.5-flash",
      temperature: 0.1,
      // maxTokens: 8000,
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
      model: this.options.model,
      generationConfig: {
        temperature: this.options.temperature,
        // maxOutputTokens: this.options.maxTokens,
      },
    });
  }

  /**
   * Analyze video using Gemini Vision
   * @param {string} videoPath - Path to video file
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeVideo(videoPath, context = {}) {
    const result = {
      filename: path.basename(videoPath),
      source: context.source || "unknown",
      model: this.options.model,
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
      } catch (parseError) {
        // If JSON parsing fails, treat as plain text transcription
        console.warn("Failed to parse JSON response, using plain text");
        result.analysis.audioTranscription = responseText;
        result.analysis.visualDescription = "Raw transcription from Gemini";
      }

      // Clean up uploaded file
      try {
        await this.fileManager.deleteFile(file.name);
        console.log("🧹 Cleaned up uploaded file");
      } catch (deleteError) {
        console.warn("Could not delete uploaded file:", deleteError.message);
      }
    } catch (error) {
      console.error(`Error analyzing video with Gemini: ${error.message}`);
      result.error = error.message;

      if (error.message.includes("API key")) {
        result.error = "Invalid or missing Gemini API key";
      } else if (error.message.includes("quota")) {
        result.error = "Gemini API quota exceeded";
      } else if (error.message.includes("size")) {
        result.error = "Video file too large for Gemini API";
      }
    }

    return result;
  }

  /**
   * Get video information using ffprobe
   */
  async getVideoInfo(videoPath) {
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
      console.warn("Could not get video info:", error.message);
      return { duration: 0 };
    }
  }

  /**
   * Get MIME type from file extension
   */
  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
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
export async function analyzeVideoWithGemini(videoPath, options = {}) {
  const analyzer = new GeminiVideoAnalyzer(options);
  return await analyzer.analyzeVideo(videoPath);
}

export default GeminiVideoAnalyzer;
