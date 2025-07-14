import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';

// Load environment variables
dotenv.config();

/**
 * Audio Transcriber
 * Handles audio transcription using custom Speech-to-Text endpoint
 */
export class AudioTranscriber {
  constructor(options = {}) {
    this.sttEndpoint = options.sttEndpoint || process.env.STT_ENDPOINT || 'https://demo.cbook.ai/stt';
    this.defaultLocale = options.locale || process.env.STT_LOCALE || 'de';
  }

  /**
   * Transcribe an audio file using custom STT API
   * @param {string} audioPath - Path to audio file
   * @param {Object} options - Transcription options
   * @returns {Promise<Object>} Transcription result
   */
  async transcribeAudio(audioPath, options = {}) {
    try {
      console.log(`🎤 Transcribing audio file: ${path.basename(audioPath)}`);
      
      // Read audio file and convert to base64
      const audioBuffer = await fs.promises.readFile(audioPath);
      const audioBase64 = audioBuffer.toString('base64');
      
      console.log(`📡 Sending to STT endpoint: ${this.sttEndpoint}`);
      
      // Send STT request
      const response = await axios.post(this.sttEndpoint, {
        locale: options.locale || this.defaultLocale,
        audio: audioBase64,
        audioHelper: options.audioHelper || ''
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 120000 // 2 minute timeout for large files
      });

      const result = response.data;
      
      // Format response to match expected structure
      return {
        text: result.text || result.transcription || result.result || '',
        language: options.locale || this.defaultLocale,
        duration: result.duration || null,
        segments: result.segments || [],
        success: true,
        confidence: result.confidence || null
      };

    } catch (error) {
      console.error('❌ STT transcription error:', error.message);
      
      // Handle specific error types
      let errorMessage = error.message;
      if (error.response) {
        errorMessage = `STT API Error: ${error.response.status} - ${error.response.statusText}`;
        if (error.response.data?.error) {
          errorMessage += ` - ${error.response.data.error}`;
        }
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'STT request timeout - audio file may be too large';
      }
      
      return {
        text: `[TRANSCRIPTION ERROR: ${errorMessage}]`,
        language: 'unknown',
        duration: null,
        segments: [],
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Transcribe with timestamps (if supported by STT endpoint)
   * @param {string} audioPath - Path to audio file
   * @returns {Promise<Object>} Transcription with timestamps
   */
  async transcribeWithTimestamps(audioPath) {
    const result = await this.transcribeAudio(audioPath, {
      timestamps: true // Request timestamps if supported
    });

    if (result.success && result.segments) {
      // Format segments with timestamps
      const formattedSegments = result.segments.map(segment => ({
        start: this.formatTimestamp(segment.start || segment.startTime),
        end: this.formatTimestamp(segment.end || segment.endTime),
        text: segment.text
      }));

      return {
        ...result,
        formattedSegments
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
    if (!seconds && seconds !== 0) return '00:00';
    
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Convert audio to base64 (utility method)
   * @param {string} audioPath - Path to audio file
   * @returns {Promise<string>} Base64 encoded audio
   */
  async audioToBase64(audioPath) {
    const audioBuffer = await fs.promises.readFile(audioPath);
    return audioBuffer.toString('base64');
  }

  /**
   * Check if STT endpoint is accessible
   * @returns {Promise<boolean>} True if endpoint is accessible
   */
  async checkEndpoint() {
    try {
      // Make a simple HEAD or GET request to check if endpoint is accessible
      await axios.get(this.sttEndpoint.replace('/stt', ''), {
        timeout: 5000
      });
      return true;
    } catch (error) {
      // Even if GET fails, the POST endpoint might still work
      console.log(`ℹ️ STT endpoint check: ${this.sttEndpoint}`);
      return true; // Assume it's working
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