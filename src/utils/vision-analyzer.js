import OpenAI from 'openai';
import fs from 'fs/promises';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

/**
 * Vision API Analyzer
 * Handles image analysis using OpenAI's Vision API
 */
export class VisionAnalyzer {
  constructor(apiKey = process.env.OPENAI_API_KEY) {
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required. Please set it in your .env file');
    }
    
    this.openai = new OpenAI({
      apiKey: apiKey
    });
    
    this.model = process.env.VISION_MODEL || 'gpt-4-vision-preview';
  }

  /**
   * Analyze an image using Vision API
   * @param {string} imagePath - Path to image file
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeImage(imagePath, options = {}) {
    try {
      console.log(`👁️ Analyzing image: ${path.basename(imagePath)}`);
      
      // Read image and convert to base64
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');
      
      // Determine image type
      const ext = path.extname(imagePath).toLowerCase();
      const mimeType = this.getMimeType(ext);
      
      // Prepare the prompt
      const prompt = options.prompt || this.getDefaultPrompt(options);
      
      // Call Vision API
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                  detail: options.detail || "high"
                }
              }
            ]
          }
        ],
        max_tokens: options.maxTokens || parseInt(process.env.MAX_TOKENS) || 4000,
        temperature: options.temperature || parseFloat(process.env.TEMPERATURE) || 0.1
      });

      const analysis = response.choices[0].message.content;

      return {
        description: analysis,
        success: true,
        tokens: response.usage?.total_tokens || 0
      };

    } catch (error) {
      console.error('❌ Vision API error:', error.message);
      return {
        description: `[VISION ANALYSIS ERROR: ${error.message}]`,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze image for document context
   * @param {string} imagePath - Path to image
   * @param {Object} context - Document context
   * @returns {Promise<Object>} Detailed analysis
   */
  async analyzeForDocument(imagePath, context = {}) {
    const prompt = `Analyze this image from a document presentation. Provide:
1. Complete description of what is shown
2. Any text visible in the image (perform OCR)
3. The purpose or meaning of this image in a presentation context
4. Any data, charts, or diagrams explained in detail
5. Emotional tone or message being conveyed
6. Technical details if it's a screenshot or interface

Context: This is from slide ${context.slideNumber || 'unknown'} of a presentation about ${context.topic || 'unknown topic'}.

Be extremely detailed and extract ALL text you can see.`;

    const result = await this.analyzeImage(imagePath, {
      prompt,
      detail: "high"
    });

    if (result.success) {
      // Parse the response to extract structured data
      return this.parseDocumentAnalysis(result.description);
    }

    return result;
  }

  /**
   * Analyze video frame
   * @param {string} framePath - Path to video frame
   * @param {number} timestamp - Frame timestamp
   * @returns {Promise<Object>} Frame analysis
   */
  async analyzeVideoFrame(framePath, timestamp) {
    const prompt = `This is a frame from a video at ${timestamp} seconds. Describe:
1. What is happening in this frame
2. Any text or UI elements visible
3. The setting or context
4. Any people and what they're doing
5. Important visual elements or changes

Focus on details that would help someone understand the video without seeing it.`;

    return await this.analyzeImage(framePath, {
      prompt,
      detail: "high"
    });
  }

  /**
   * Extract text from image (OCR focus)
   * @param {string} imagePath - Path to image
   * @returns {Promise<string>} Extracted text
   */
  async extractText(imagePath) {
    const prompt = `Extract and transcribe ALL text visible in this image. 
Include:
- Main text
- Small text
- Text in logos
- Text on buttons or UI elements
- Any numbers or data
- Text in different languages

Format: Return ONLY the text found, preserving the layout as much as possible.`;

    const result = await this.analyzeImage(imagePath, {
      prompt,
      detail: "high"
    });

    return result.success ? result.description : '';
  }

  /**
   * Get MIME type from file extension
   * @param {string} ext - File extension
   * @returns {string} MIME type
   */
  getMimeType(ext) {
    const types = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    };
    return types[ext] || 'image/jpeg';
  }

  /**
   * Get default prompt based on options
   * @param {Object} options - Analysis options
   * @returns {string} Default prompt
   */
  getDefaultPrompt(options) {
    if (options.extractText) {
      return 'Extract all text from this image.';
    }
    
    return `Provide a detailed description of this image including:
1. What is shown in the image
2. Any text visible (perform OCR)
3. Colors, layout, and design elements
4. The purpose or meaning
5. Any notable details`;
  }

  /**
   * Parse document analysis response
   * @param {string} analysis - Raw analysis text
   * @returns {Object} Structured analysis
   */
  parseDocumentAnalysis(analysis) {
    // This is a simple parser - could be enhanced with better NLP
    const sections = {
      description: '',
      extractedText: '',
      purpose: '',
      details: '',
      emotion: '',
      technical: ''
    };

    // Try to extract sections based on numbering or keywords
    const lines = analysis.split('\n');
    let currentSection = 'description';
    
    for (const line of lines) {
      if (line.includes('text visible') || line.includes('OCR')) {
        currentSection = 'extractedText';
      } else if (line.includes('purpose') || line.includes('meaning')) {
        currentSection = 'purpose';
      } else if (line.includes('emotional') || line.includes('tone')) {
        currentSection = 'emotion';
      } else if (line.includes('technical') || line.includes('screenshot')) {
        currentSection = 'technical';
      }
      
      sections[currentSection] += line + '\n';
    }

    return {
      fullAnalysis: analysis,
      ...sections,
      success: true
    };
  }
}

/**
 * Simple image analysis function
 */
export async function analyzeImageWithVision(imagePath, apiKey) {
  const analyzer = new VisionAnalyzer(apiKey);
  return await analyzer.analyzeImage(imagePath);
}

export default VisionAnalyzer;