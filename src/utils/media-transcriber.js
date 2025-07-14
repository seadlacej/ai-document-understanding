import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { AudioTranscriber } from './audio-transcriber.js';
import { VisionAnalyzer } from './vision-analyzer.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Media Transcriber Module
 * Handles extraction and transcription of audio/video content
 * Integrates with Whisper API or other transcription services
 */

export class MediaTranscriber {
  constructor(options = {}) {
    this.options = {
      tempDir: options.tempDir || './temp',
      whisperApiKey: options.whisperApiKey || process.env.OPENAI_API_KEY,
      whisperModel: options.whisperModel || 'whisper-1',
      extractAudio: options.extractAudio !== false,
      frameExtraction: options.frameExtraction !== false,
      frameInterval: options.frameInterval || 5, // seconds
      ...options
    };
  }

  /**
   * Transcribe video file with both audio and visual analysis
   * @param {string} videoPath - Path to video file
   * @param {Object} options - Transcription options
   * @returns {Promise<Object>} Complete transcription with audio and visual elements
   */
  async transcribeVideo(videoPath, options = {}) {
    const result = {
      filename: path.basename(videoPath),
      duration: null,
      audio: {
        transcription: '',
        language: null,
        confidence: null
      },
      visual: {
        keyFrames: [],
        sceneDescriptions: [],
        textInVideo: []
      },
      combined: {
        narrative: '',
        timeline: []
      }
    };

    try {
      // Get video metadata
      const metadata = await this.getVideoMetadata(videoPath);
      result.duration = metadata.duration;

      // Extract and transcribe audio
      if (this.options.extractAudio) {
        const audioPath = await this.extractAudioFromVideo(videoPath);
        result.audio = await this.transcribeAudio(audioPath);
        
        // Clean up temp audio file
        await fs.unlink(audioPath).catch(() => {});
      }

      // Extract and analyze video frames
      if (this.options.frameExtraction) {
        const frames = await this.extractKeyFrames(videoPath);
        result.visual = await this.analyzeVideoFrames(frames);
        
        // Clean up temp frame files
        for (const frame of frames) {
          await fs.unlink(frame.path).catch(() => {});
        }
      }

      // Combine audio and visual analysis
      result.combined = this.combineAudioVisualAnalysis(result.audio, result.visual);

    } catch (error) {
      console.error(`Error transcribing video ${videoPath}:`, error);
      result.error = error.message;
    }

    return result;
  }

  /**
   * Extract audio from video file using ffmpeg
   * @param {string} videoPath - Path to video file
   * @returns {Promise<string>} Path to extracted audio file
   */
  async extractAudioFromVideo(videoPath) {
    const audioPath = path.join(
      this.options.tempDir, 
      `audio_${Date.now()}_${path.basename(videoPath, path.extname(videoPath))}.mp3`
    );

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', videoPath,
        '-vn', // no video
        '-acodec', 'mp3',
        '-ar', '16000', // 16kHz sample rate for speech
        '-ac', '1', // mono
        audioPath
      ]);

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(audioPath);
        } else {
          reject(new Error(`ffmpeg exited with code ${code}`));
        }
      });

      ffmpeg.on('error', (err) => {
        reject(new Error(`ffmpeg not found or failed: ${err.message}`));
      });
    });
  }

  /**
   * Transcribe audio file using custom STT endpoint
   * @param {string} audioPath - Path to audio file
   * @returns {Promise<Object>} Transcription result
   */
  async transcribeAudio(audioPath) {
    try {
      // Use custom STT endpoint for transcription
      const audioTranscriber = new AudioTranscriber({
        sttEndpoint: this.options.sttEndpoint,
        locale: this.options.sttLocale || 'de'
      });
      const result = await audioTranscriber.transcribeWithTimestamps(audioPath);
      
      if (result.success) {
        return {
          transcription: result.text,
          language: result.language,
          confidence: result.confidence || 100,
          segments: result.formattedSegments || []
        };
      } else {
        return {
          transcription: `[TRANSCRIPTION FAILED: ${result.error}]`,
          language: 'unknown',
          confidence: 0
        };
      }
    } catch (error) {
      return {
        transcription: `[AUDIO TRANSCRIPTION ERROR: ${error.message}]`,
        language: 'unknown',
        confidence: 0
      };
    }
  }

  /**
   * Extract key frames from video at regular intervals
   * @param {string} videoPath - Path to video file
   * @returns {Promise<Array>} Array of frame file paths with timestamps
   */
  async extractKeyFrames(videoPath) {
    const frames = [];
    const metadata = await this.getVideoMetadata(videoPath);
    const duration = parseFloat(metadata.duration);
    
    // Calculate frame extraction points
    const frameCount = Math.floor(duration / this.options.frameInterval);
    
    for (let i = 0; i <= frameCount; i++) {
      const timestamp = i * this.options.frameInterval;
      const framePath = path.join(
        this.options.tempDir,
        `frame_${Date.now()}_${i}.jpg`
      );

      await this.extractFrame(videoPath, timestamp, framePath);
      frames.push({
        path: framePath,
        timestamp: timestamp,
        index: i
      });
    }

    return frames;
  }

  /**
   * Extract a single frame from video
   * @param {string} videoPath - Path to video file
   * @param {number} timestamp - Timestamp in seconds
   * @param {string} outputPath - Path for output frame
   */
  async extractFrame(videoPath, timestamp, outputPath) {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-ss', timestamp.toString(),
        '-i', videoPath,
        '-vframes', '1',
        '-f', 'image2',
        outputPath
      ]);

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`Frame extraction failed at ${timestamp}s`));
        }
      });

      ffmpeg.on('error', reject);
    });
  }

  /**
   * Analyze video frames for visual content
   * @param {Array} frames - Array of frame objects
   * @returns {Promise<Object>} Visual analysis results
   */
  async analyzeVideoFrames(frames) {
    const visual = {
      keyFrames: [],
      sceneDescriptions: [],
      textInVideo: []
    };

    // Check if we have Vision API key
    if (!this.options.whisperApiKey) {
      for (const frame of frames) {
        visual.keyFrames.push({
          timestamp: frame.timestamp,
          description: `[FRAME at ${frame.timestamp}s - REQUIRES VISION API KEY]`,
          objects: [],
          text: []
        });
      }
      return visual;
    }

    // Use Vision API to analyze each frame
    const vision = new VisionAnalyzer(this.options.whisperApiKey);
    
    for (const frame of frames) {
      try {
        console.log(`🎥 Analyzing video frame at ${frame.timestamp}s...`);
        const analysis = await vision.analyzeVideoFrame(frame.path, frame.timestamp);
        
        if (analysis.success) {
          visual.keyFrames.push({
            timestamp: frame.timestamp,
            description: analysis.description,
            objects: this.extractObjectsFromAnalysis(analysis.description),
            text: this.extractTextFromAnalysis(analysis.description)
          });
          
          // Extract any text found in the frame
          const textInFrame = this.extractTextFromAnalysis(analysis.description);
          if (textInFrame.length > 0) {
            visual.textInVideo.push({
              timestamp: frame.timestamp,
              text: textInFrame.join(' ')
            });
          }
        } else {
          visual.keyFrames.push({
            timestamp: frame.timestamp,
            description: `[FRAME ANALYSIS ERROR: ${analysis.error}]`,
            objects: [],
            text: []
          });
        }
      } catch (error) {
        visual.keyFrames.push({
          timestamp: frame.timestamp,
          description: `[FRAME ANALYSIS FAILED: ${error.message}]`,
          objects: [],
          text: []
        });
      }
    }

    // Generate scene descriptions based on analyzed frames
    if (visual.keyFrames.length > 0) {
      visual.sceneDescriptions = this.generateSceneDescriptions(visual.keyFrames);
    }

    return visual;
  }

  /**
   * Extract objects mentioned in frame analysis
   */
  extractObjectsFromAnalysis(description) {
    const objects = [];
    const patterns = [
      /shows?\s+(\w+(?:\s+\w+)?)/gi,
      /contains?\s+(\w+(?:\s+\w+)?)/gi,
      /features?\s+(\w+(?:\s+\w+)?)/gi,
      /see\s+(?:a\s+)?(\w+(?:\s+\w+)?)/gi
    ];
    
    patterns.forEach(pattern => {
      const matches = description.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length > 2) {
          objects.push(match[1].trim());
        }
      }
    });
    
    return [...new Set(objects)].slice(0, 5);
  }

  /**
   * Extract text mentioned in frame analysis
   */
  extractTextFromAnalysis(description) {
    const textMentions = [];
    
    // Look for quoted text
    const quotedText = description.match(/"([^"]+)"/g);
    if (quotedText) {
      textMentions.push(...quotedText.map(t => t.replace(/"/g, '')));
    }
    
    // Look for text after "text:" or "reads:"
    const textPatterns = [
      /text:?\s*"?([^"\n]+)"?/gi,
      /reads:?\s*"?([^"\n]+)"?/gi,
      /says:?\s*"?([^"\n]+)"?/gi,
      /displays:?\s*"?([^"\n]+)"?/gi
    ];
    
    textPatterns.forEach(pattern => {
      const matches = description.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          textMentions.push(match[1].trim());
        }
      }
    });
    
    return [...new Set(textMentions)];
  }

  /**
   * Generate scene descriptions from analyzed frames
   */
  generateSceneDescriptions(keyFrames) {
    const scenes = [];
    let currentScene = null;
    
    for (let i = 0; i < keyFrames.length; i++) {
      const frame = keyFrames[i];
      
      if (!currentScene) {
        currentScene = {
          start: frame.timestamp,
          end: frame.timestamp,
          description: frame.description,
          keyElements: []
        };
      } else {
        // Check if this is a continuation of the current scene
        // In a more sophisticated implementation, this would use scene similarity
        currentScene.end = frame.timestamp;
        currentScene.keyElements.push(frame.description);
        
        // Create a new scene every 3 frames or at significant changes
        if (i % 3 === 0 || i === keyFrames.length - 1) {
          scenes.push({
            start: currentScene.start,
            end: currentScene.end,
            description: this.summarizeScene(currentScene)
          });
          currentScene = null;
        }
      }
    }
    
    return scenes;
  }

  /**
   * Summarize a scene from multiple frame descriptions
   */
  summarizeScene(scene) {
    if (!scene.keyElements || scene.keyElements.length === 0) {
      return scene.description;
    }
    
    // Simple summarization - in production, this could use an LLM
    const duration = scene.end - scene.start;
    return `Scene from ${scene.start}s to ${scene.end}s (${duration}s): ${scene.description}`;
  }

  /**
   * Get video metadata using ffprobe
   * @param {string} videoPath - Path to video file
   * @returns {Promise<Object>} Video metadata
   */
  async getVideoMetadata(videoPath) {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'json',
        videoPath
      ]);

      let output = '';
      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code === 0) {
          try {
            const metadata = JSON.parse(output);
            resolve({
              duration: metadata.format?.duration || '0'
            });
          } catch (error) {
            reject(new Error('Failed to parse video metadata'));
          }
        } else {
          reject(new Error('ffprobe failed'));
        }
      });

      ffprobe.on('error', () => {
        // If ffprobe is not available, return default metadata
        resolve({ duration: '0' });
      });
    });
  }

  /**
   * Combine audio and visual analysis into a unified narrative
   * @param {Object} audio - Audio transcription data
   * @param {Object} visual - Visual analysis data
   * @returns {Object} Combined analysis
   */
  combineAudioVisualAnalysis(audio, visual) {
    const combined = {
      narrative: '',
      timeline: []
    };

    // Create a comprehensive narrative
    if (audio.transcription && !audio.placeholder) {
      combined.narrative = `Audio: ${audio.transcription}\n\n`;
    }

    if (visual.sceneDescriptions.length > 0) {
      combined.narrative += `Visual: ${visual.sceneDescriptions.map(s => s.description).join(' ')}\n\n`;
    }

    // Create timeline events
    for (const frame of visual.keyFrames) {
      combined.timeline.push({
        timestamp: frame.timestamp,
        type: 'visual',
        content: frame.description
      });
    }

    // If we had real audio transcription with timestamps, we'd merge them here
    if (!audio.placeholder) {
      // Add audio events to timeline
    }

    // Sort timeline by timestamp
    combined.timeline.sort((a, b) => a.timestamp - b.timestamp);

    if (!combined.narrative) {
      combined.narrative = '[COMPLETE TRANSCRIPTION REQUIRES API KEYS FOR AUDIO AND VISUAL ANALYSIS]';
    }

    return combined;
  }

  /**
   * Check if required tools (ffmpeg, ffprobe) are available
   * @returns {Promise<Object>} Tool availability status
   */
  async checkDependencies() {
    const deps = {
      ffmpeg: false,
      ffprobe: false
    };

    try {
      await this.runCommand('ffmpeg', ['-version']);
      deps.ffmpeg = true;
    } catch (e) {
      console.warn('ffmpeg not found - video processing will be limited');
    }

    try {
      await this.runCommand('ffprobe', ['-version']);
      deps.ffprobe = true;
    } catch (e) {
      console.warn('ffprobe not found - video metadata extraction will be limited');
    }

    return deps;
  }

  /**
   * Helper to run a command and check if it exists
   */
  async runCommand(command, args) {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args);
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`${command} exited with code ${code}`));
      });
      proc.on('error', reject);
    });
  }
}

/**
 * Simple audio transcriber for basic use cases
 */
export async function transcribeAudioSimple(audioPath, apiKey) {
  const transcriber = new MediaTranscriber({ whisperApiKey: apiKey });
  return await transcriber.transcribeAudio(audioPath);
}

/**
 * Full video transcription with audio and visual analysis
 */
export async function transcribeVideoComplete(videoPath, options = {}) {
  const transcriber = new MediaTranscriber(options);
  return await transcriber.transcribeVideo(videoPath);
}

export default MediaTranscriber;