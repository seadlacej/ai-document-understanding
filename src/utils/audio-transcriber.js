import fs from "fs";
import dotenv from "dotenv";
import path from "path";
import axios from "axios";
import { AzureOpenAI } from "openai";

// Load environment variables
dotenv.config();

/**
 * Audio Transcriber
 * Handles audio transcription using Azure OpenAI Whisper or custom STT endpoint
 */
export class AudioTranscriber {
  constructor(options = {}) {
    // Azure OpenAI configuration
    this.useAzureOpenAI =
      process.env.USE_AZURE_OPENAI === "true" || options.useAzureOpenAI;

    if (this.useAzureOpenAI) {
      // Initialize Azure OpenAI client
      this.azureClient = new AzureOpenAI({
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-02-01",
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      });
      this.deploymentName =
        process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "whisper";
    } else {
      // Fallback to custom STT endpoint
      this.sttEndpoint =
        process.env.STT_ENDPOINT || "https://demo.cbook.ai/stt";
    }

    this.defaultLocale = process.env.STT_LOCALE || "de";
  }

  /**
   * Transcribe an audio file using Azure OpenAI or custom STT API
   * @param {string} audioPath - Path to audio file
   * @param {Object} options - Transcription options
   * @returns {Promise<Object>} Transcription result
   */
  async transcribeAudio(audioPath, options = {}) {
    if (this.useAzureOpenAI) {
      return await this.transcribeWithAzureOpenAI(audioPath, options);
    } else {
      return await this.transcribeWithCustomSTT(audioPath, options);
    }
  }

  /**
   * Transcribe audio using Azure OpenAI Whisper
   * @param {string} audioPath - Path to audio file
   * @param {Object} options - Transcription options
   * @returns {Promise<Object>} Transcription result
   */
  async transcribeWithAzureOpenAI(audioPath, options = {}) {
    try {
      console.log(
        `🎤 Transcribing audio file with Azure OpenAI: ${path.basename(
          audioPath
        )}`
      );

      // Check file size (Azure OpenAI supports up to 25MB)
      const stats = await fs.promises.stat(audioPath);
      const fileSizeMB = stats.size / (1024 * 1024);

      if (fileSizeMB > 25) {
        throw new Error(
          `File too large: ${fileSizeMB.toFixed(2)}MB (max 25MB)`
        );
      }

      console.log(`📊 File size: ${fileSizeMB.toFixed(2)}MB`);

      // Create a readable stream from the audio file
      const audioStream = fs.createReadStream(audioPath);

      // Prepare transcription options
      const transcriptionOptions = {
        file: audioStream,
        model: this.deploymentName,
        language: options.locale || this.defaultLocale,
        response_format: options.timestamps ? "verbose_json" : "json",
      };

      // Add optional prompt for better accuracy
      if (options.prompt) {
        transcriptionOptions.prompt = options.prompt;
      }

      console.log(`🔤 Language: ${transcriptionOptions.language}`);
      console.log(`📡 Sending to Azure OpenAI...`);

      // Call Azure OpenAI Whisper API
      const response = await this.azureClient.audio.transcriptions.create(
        transcriptionOptions
      );

      // Format response based on response format
      let result;
      if (options.timestamps && response.segments) {
        // Verbose JSON format with timestamps
        result = {
          text: response.text,
          language: response.language || transcriptionOptions.language,
          duration: response.duration || null,
          segments: response.segments.map((segment) => ({
            id: segment.id,
            start: segment.start,
            end: segment.end,
            text: segment.text,
            confidence: segment.confidence || null,
          })),
          success: true,
          confidence: response.confidence || null,
        };
      } else {
        // Simple JSON format
        result = {
          text: response.text,
          language: transcriptionOptions.language,
          duration: null,
          segments: [],
          success: true,
          confidence: null,
        };
      }

      console.log(
        `✅ Transcription successful: ${result.text.split(" ").length} words`
      );
      return result;
    } catch (error) {
      console.error("❌ Azure OpenAI transcription error:", error.message);

      let errorMessage = error.message;
      if (error.response) {
        errorMessage = `Azure OpenAI Error: ${error.response.status} - ${error.response.statusText}`;
        if (error.response.data?.error) {
          errorMessage += ` - ${
            error.response.data.error.message || error.response.data.error
          }`;
        }
      }

      return {
        text: `[TRANSCRIPTION ERROR: ${errorMessage}]`,
        language: "unknown",
        duration: null,
        segments: [],
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Transcribe audio using custom STT endpoint (fallback)
   * @param {string} audioPath - Path to audio file
   * @param {Object} options - Transcription options
   * @returns {Promise<Object>} Transcription result
   */
  async transcribeWithCustomSTT(audioPath, options = {}) {
    try {
      console.log(
        `🎤 Transcribing audio file with custom STT: ${path.basename(
          audioPath
        )}`
      );

      // Read audio file and convert to base64
      const audioBuffer = await fs.promises.readFile(audioPath);
      const audioBase64 = audioBuffer.toString("base64");

      console.log(`📡 Sending to STT endpoint: ${this.sttEndpoint}`);

      // Prepare request data
      const requestData = {
        locale: options.locale || this.defaultLocale,
        audio: audioBase64,
        audioHelper: options.audioHelper || "",
      };

      console.log(
        `📊 Request data: locale=${requestData.locale}, audio length=${audioBase64.length}, audioHelper="${requestData.audioHelper}"`
      );

      // Send STT request
      const response = await axios.post(this.sttEndpoint, requestData, {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 120000, // 2 minute timeout for large files
      });

      const result = response.data;

      // Format response to match expected structure
      return {
        text: result.text || result.transcription || result.result || "",
        language: options.locale || this.defaultLocale,
        duration: result.duration || null,
        segments: result.segments || [],
        success: true,
        confidence: result.confidence || null,
      };
    } catch (error) {
      console.error("❌ STT transcription error:", error.message);

      // Handle specific error types
      let errorMessage = error.message;
      if (error.response) {
        errorMessage = `STT API Error: ${error.response.status} - ${error.response.statusText}`;
        if (error.response.data?.error) {
          errorMessage += ` - ${error.response.data.error}`;
        }
        // Log full response for debugging
        console.error(
          "Full error response:",
          JSON.stringify(error.response.data, null, 2)
        );
      } else if (error.code === "ECONNABORTED") {
        errorMessage = "STT request timeout - audio file may be too large";
      }

      return {
        text: `[TRANSCRIPTION ERROR: ${errorMessage}]`,
        language: "unknown",
        duration: null,
        segments: [],
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Transcribe with timestamps
   * @param {string} audioPath - Path to audio file
   * @returns {Promise<Object>} Transcription with timestamps
   */
  async transcribeWithTimestamps(audioPath, options = {}) {
    const result = await this.transcribeAudio(audioPath, {
      ...options,
      timestamps: true,
    });

    if (result.success && result.segments && result.segments.length > 0) {
      // Format segments with timestamps
      const formattedSegments = result.segments.map((segment) => ({
        start: this.formatTimestamp(segment.start),
        end: this.formatTimestamp(segment.end),
        text: segment.text,
        confidence: segment.confidence,
      }));

      return {
        ...result,
        formattedSegments,
      };
    }

    return result;
  }

  /**
   * Format timestamp from seconds to readable format
   * @param {number} seconds - Time in seconds
   * @returns {string} Formatted timestamp
   */
  formatTimestamp(seconds) {
    if (typeof seconds !== "number") return "00:00";

    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }

  /**
   * Check if transcription service is available
   * @returns {Promise<boolean>} True if service is accessible
   */
  async checkEndpoint() {
    if (this.useAzureOpenAI) {
      try {
        // Check if Azure OpenAI credentials are configured
        return !!(
          process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT
        );
      } catch (error) {
        console.error("Azure OpenAI configuration error:", error.message);
        return false;
      }
    } else {
      try {
        // Check custom STT endpoint
        await axios.get(this.sttEndpoint.replace("/stt", ""), {
          timeout: 5000,
        });
        return true;
      } catch (error) {
        console.log(`ℹ️ STT endpoint check: ${this.sttEndpoint}`);
        return true; // Assume it's working
      }
    }
  }

  /**
   * Get configuration info
   * @returns {Object} Configuration details
   */
  getConfig() {
    if (this.useAzureOpenAI) {
      return {
        service: "Azure OpenAI Whisper",
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        deploymentName: this.deploymentName,
        maxFileSize: "25MB",
        supportedFormats: ["mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm"],
      };
    } else {
      return {
        service: "Custom STT",
        endpoint: this.sttEndpoint,
        maxFileSize: "~2MB (estimated)",
        supportedFormats: ["wav", "mp3"],
      };
    }
  }
}

/**
 * Simple transcription function
 */
export async function transcribeAudioFile(audioPath, options = {}) {
  const transcriber = new AudioTranscriber(options);
  return await transcriber.transcribeAudio(audioPath);
}

export default AudioTranscriber;
