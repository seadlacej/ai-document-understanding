import Tesseract from 'tesseract.js';
import fs from 'fs/promises';
import path from 'path';
import { VisionAnalyzer } from './vision-analyzer.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Image Analyzer Module
 * Handles OCR text extraction and visual analysis of images
 * Integrates with AI vision APIs for comprehensive understanding
 */

export class ImageAnalyzer {
  constructor(options = {}) {
    this.options = {
      ocrLanguages: options.ocrLanguages || ['eng', 'deu'], // English and German
      visionApiKey: options.visionApiKey || process.env.OPENAI_API_KEY,
      enableOCR: options.enableOCR !== false,
      enableVisualAnalysis: options.enableVisualAnalysis !== false,
      confidenceThreshold: options.confidenceThreshold || 60,
      ...options
    };
  }

  /**
   * Analyze image with OCR and visual description
   * @param {string} imagePath - Path to image file
   * @param {Object} context - Additional context (slide number, etc.)
   * @returns {Promise<Object>} Complete image analysis
   */
  async analyzeImage(imagePath, context = {}) {
    const result = {
      filename: path.basename(imagePath),
      source: context.source || 'unknown',
      analysis: {
        ocr: {
          text: '',
          confidence: 0,
          words: []
        },
        visual: {
          description: '',
          objects: [],
          colors: [],
          emotions: [],
          themes: []
        },
        combined: {
          fullDescription: '',
          significance: '',
          keyInsights: []
        }
      }
    };

    try {
      // Perform OCR if enabled
      if (this.options.enableOCR) {
        result.analysis.ocr = await this.performOCR(imagePath);
      }

      // Perform visual analysis if enabled
      if (this.options.enableVisualAnalysis) {
        result.analysis.visual = await this.performVisualAnalysis(imagePath);
      }

      // Combine OCR and visual analysis
      result.analysis.combined = this.combineAnalyses(
        result.analysis.ocr, 
        result.analysis.visual,
        context
      );

    } catch (error) {
      console.error(`Error analyzing image ${imagePath}:`, error);
      result.error = error.message;
    }

    return result;
  }

  /**
   * Perform OCR on image using Tesseract.js
   * @param {string} imagePath - Path to image file
   * @returns {Promise<Object>} OCR results
   */
  async performOCR(imagePath) {
    try {
      const worker = await Tesseract.createWorker();
      
      // Initialize worker with languages
      await worker.loadLanguage(this.options.ocrLanguages.join('+'));
      await worker.initialize(this.options.ocrLanguages.join('+'));
      
      // Perform OCR
      const { data } = await worker.recognize(imagePath);
      
      // Terminate worker
      await worker.terminate();

      // Filter words by confidence
      const confidentWords = data.words.filter(
        word => word.confidence > this.options.confidenceThreshold
      );

      return {
        text: data.text.trim(),
        confidence: data.confidence,
        words: confidentWords.map(word => ({
          text: word.text,
          confidence: word.confidence,
          bbox: word.bbox
        }))
      };
    } catch (error) {
      console.error('OCR error:', error);
      return {
        text: '[OCR FAILED]',
        confidence: 0,
        words: [],
        error: error.message
      };
    }
  }

  /**
   * Perform visual analysis on image
   * @param {string} imagePath - Path to image file
   * @returns {Promise<Object>} Visual analysis results
   */
  async performVisualAnalysis(imagePath) {
    // Check if we have an API key for vision analysis
    if (!this.options.visionApiKey) {
      const fileStats = await fs.stat(imagePath);
      return {
        description: `[IMAGE VISUAL ANALYSIS REQUIRES API KEY - Please set OPENAI_API_KEY in .env file]`,
        objects: [],
        colors: [],
        emotions: [],
        themes: [],
        placeholder: true
      };
    }

    try {
      // Use Vision API for analysis
      const vision = new VisionAnalyzer(this.options.visionApiKey);
      const result = await vision.analyzeForDocument(imagePath, {
        topic: 'document presentation'
      });
      
      if (result.success) {
        // Extract structured data from the analysis
        return {
          description: result.description || result.fullAnalysis,
          objects: this.extractObjects(result.fullAnalysis),
          colors: this.extractColors(result.fullAnalysis),
          emotions: this.extractEmotions(result.fullAnalysis),
          themes: this.extractThemes(result.fullAnalysis),
          extractedText: result.extractedText || '',
          placeholder: false
        };
      } else {
        return {
          description: `[VISION ANALYSIS FAILED: ${result.error}]`,
          objects: [],
          colors: [],
          emotions: [],
          themes: [],
          error: result.error
        };
      }
    } catch (error) {
      return {
        description: `[VISUAL ANALYSIS ERROR: ${error.message}]`,
        objects: [],
        colors: [],
        emotions: [],
        themes: [],
        error: error.message
      };
    }
  }

  /**
   * Extract objects mentioned in analysis
   */
  extractObjects(text) {
    const objects = [];
    const patterns = [
      /shows?\s+(\w+\s+\w+)/gi,
      /contains?\s+(\w+\s+\w+)/gi,
      /features?\s+(\w+\s+\w+)/gi,
      /displays?\s+(\w+\s+\w+)/gi
    ];
    
    patterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) objects.push(match[1]);
      }
    });
    
    return [...new Set(objects)].slice(0, 5);
  }

  /**
   * Extract colors mentioned in analysis
   */
  extractColors(text) {
    const colorPattern = /\b(red|blue|green|yellow|orange|purple|black|white|gray|grey|brown|pink)\b/gi;
    const matches = text.match(colorPattern) || [];
    return [...new Set(matches.map(c => c.toLowerCase()))];
  }

  /**
   * Extract emotions or tone
   */
  extractEmotions(text) {
    const emotionWords = [
      'professional', 'modern', 'clean', 'friendly', 'serious',
      'innovative', 'traditional', 'dynamic', 'calm', 'energetic',
      'trustworthy', 'approachable', 'corporate', 'casual', 'formal'
    ];
    
    const found = emotionWords.filter(emotion => 
      text.toLowerCase().includes(emotion)
    );
    
    return found.slice(0, 3);
  }

  /**
   * Extract themes
   */
  extractThemes(text) {
    const themeWords = [
      'technology', 'education', 'business', 'environment', 'sustainability',
      'innovation', 'communication', 'learning', 'growth', 'development',
      'collaboration', 'digital', 'transformation', 'solution', 'platform'
    ];
    
    const found = themeWords.filter(theme => 
      text.toLowerCase().includes(theme)
    );
    
    return found.slice(0, 3);
  }

  /**
   * Combine OCR and visual analysis into comprehensive understanding
   * @param {Object} ocr - OCR results
   * @param {Object} visual - Visual analysis results
   * @param {Object} context - Additional context
   * @returns {Object} Combined analysis
   */
  combineAnalyses(ocr, visual, context) {
    const combined = {
      fullDescription: '',
      significance: '',
      keyInsights: []
    };

    // Build full description
    const parts = [];
    
    if (visual.description && !visual.placeholder) {
      parts.push(`Visual: ${visual.description}`);
    }
    
    if (ocr.text) {
      parts.push(`Text found: "${ocr.text}"`);
    }
    
    if (visual.objects && visual.objects.length > 0 && !visual.placeholder) {
      parts.push(`Objects: ${visual.objects.join(', ')}`);
    }

    combined.fullDescription = parts.join(' | ') || '[Requires API keys for complete analysis]';

    // Determine significance based on context
    if (context.slideNumber) {
      combined.significance = `Image on slide ${context.slideNumber}`;
    }
    
    if (ocr.text && ocr.confidence > 80) {
      combined.keyInsights.push('High-confidence text extraction');
    }
    
    if (visual.emotions && visual.emotions.length > 0 && !visual.placeholder) {
      combined.keyInsights.push(`Emotional tone: ${visual.emotions.join(', ')}`);
    }

    return combined;
  }

  /**
   * Batch analyze multiple images
   * @param {Array} imagePaths - Array of image paths
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Array>} Array of analysis results
   */
  async analyzeImages(imagePaths, onProgress) {
    const results = [];
    
    for (let i = 0; i < imagePaths.length; i++) {
      const imagePath = imagePaths[i];
      const result = await this.analyzeImage(imagePath, {
        index: i,
        total: imagePaths.length
      });
      
      results.push(result);
      
      if (onProgress) {
        onProgress(i + 1, imagePaths.length, result);
      }
    }
    
    return results;
  }

  /**
   * Extract text from image (OCR only)
   * @param {string} imagePath - Path to image file
   * @returns {Promise<string>} Extracted text
   */
  async extractText(imagePath) {
    const ocr = await this.performOCR(imagePath);
    return ocr.text;
  }

  /**
   * Get detailed image analysis in markdown format
   * @param {string} imagePath - Path to image file
   * @param {Object} context - Additional context
   * @returns {Promise<string>} Markdown formatted analysis
   */
  async getMarkdownAnalysis(imagePath, context = {}) {
    const analysis = await this.analyzeImage(imagePath, context);
    
    let markdown = `## Image Analysis: ${analysis.filename}\n\n`;
    
    if (analysis.error) {
      markdown += `**Error**: ${analysis.error}\n\n`;
      return markdown;
    }
    
    // Add visual description
    markdown += `### Visual Description\n${analysis.analysis.visual.description}\n\n`;
    
    // Add OCR results
    if (analysis.analysis.ocr.text) {
      markdown += `### Text Content (OCR)\n`;
      markdown += `**Extracted Text**: "${analysis.analysis.ocr.text}"\n`;
      markdown += `**Confidence**: ${analysis.analysis.ocr.confidence}%\n\n`;
    }
    
    // Add combined analysis
    markdown += `### Combined Analysis\n`;
    markdown += `**Full Description**: ${analysis.analysis.combined.fullDescription}\n`;
    
    if (analysis.analysis.combined.significance) {
      markdown += `**Significance**: ${analysis.analysis.combined.significance}\n`;
    }
    
    if (analysis.analysis.combined.keyInsights.length > 0) {
      markdown += `**Key Insights**:\n`;
      analysis.analysis.combined.keyInsights.forEach(insight => {
        markdown += `- ${insight}\n`;
      });
    }
    
    return markdown;
  }
}

/**
 * Quick OCR extraction
 */
export async function quickOCR(imagePath, languages = ['eng']) {
  const analyzer = new ImageAnalyzer({ 
    ocrLanguages: languages,
    enableVisualAnalysis: false 
  });
  return await analyzer.extractText(imagePath);
}

/**
 * Full image analysis with all features
 */
export async function analyzeImageComplete(imagePath, options = {}) {
  const analyzer = new ImageAnalyzer(options);
  return await analyzer.analyzeImage(imagePath);
}

export default ImageAnalyzer;