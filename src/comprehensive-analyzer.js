import { PPTXParser } from './parsers/pptx-parser.js';
import { ImageAnalyzer } from './utils/image-analyzer.js';
import { MediaTranscriber } from './utils/media-transcriber.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Comprehensive Document Analyzer
 * Extracts and transcribes ALL content from documents including:
 * - Text content
 * - Images with OCR and visual description
 * - Videos with audio transcription and visual analysis
 * - Hidden content
 * - Metadata
 */

export class ComprehensiveAnalyzer {
  constructor(options = {}) {
    this.options = {
      outputFormat: options.outputFormat || 'markdown',
      includeTimestamps: options.includeTimestamps !== false,
      tempDir: options.tempDir || './temp',
      whisperApiKey: options.whisperApiKey || process.env.OPENAI_API_KEY,
      visionApiKey: options.visionApiKey || process.env.OPENAI_API_KEY,
      ...options
    };

    this.pptxParser = new PPTXParser({ tempDir: this.options.tempDir });
    this.imageAnalyzer = new ImageAnalyzer({
      visionApiKey: this.options.visionApiKey,
      enableOCR: true,
      enableVisualAnalysis: true
    });
    this.mediaTranscriber = new MediaTranscriber({
      sttEndpoint: this.options.sttEndpoint || process.env.STT_ENDPOINT,
      sttLocale: this.options.sttLocale || process.env.STT_LOCALE || 'de',
      whisperApiKey: this.options.whisperApiKey,
      tempDir: this.options.tempDir
    });
  }

  /**
   * Analyze document and extract ALL content with full transcription
   * @param {string} filePath - Path to document
   * @returns {Promise<Object>} Complete transcribed content
   */
  async analyzeDocument(filePath) {
    console.log(`\n🔍 Starting comprehensive analysis of: ${path.basename(filePath)}`);
    console.log('This will extract and transcribe ALL content...\n');

    const result = {
      metadata: {},
      fullTranscription: '',
      slides: [],
      extractedContent: {
        text: [],
        images: [],
        videos: [],
        audio: []
      },
      summary: {
        totalSlides: 0,
        totalText: 0,
        totalImages: 0,
        totalVideos: 0,
        processingTime: 0
      }
    };

    const startTime = Date.now();

    try {
      // Parse the document structure
      console.log('📄 Parsing document structure...');
      const parsed = await this.pptxParser.parse(filePath);
      
      result.metadata = parsed.metadata;
      result.summary.totalSlides = parsed.slides.length;

      // Process each slide
      for (const slide of parsed.slides) {
        console.log(`\n📑 Processing Slide ${slide.number}...`);
        const slideContent = await this.processSlide(slide, parsed.media);
        result.slides.push(slideContent);
      }

      // Process hidden slides
      if (parsed.hiddenSlides.length > 0) {
        console.log(`\n🔒 Processing ${parsed.hiddenSlides.length} hidden slides...`);
        for (const slide of parsed.hiddenSlides) {
          const slideContent = await this.processSlide(slide, parsed.media);
          slideContent.isHidden = true;
          result.slides.push(slideContent);
        }
      }

      // Generate full transcription
      result.fullTranscription = this.generateFullTranscription(result);
      
      // Update summary
      result.summary.processingTime = Date.now() - startTime;
      result.summary.totalImages = result.extractedContent.images.length;
      result.summary.totalVideos = result.extractedContent.videos.length;
      result.summary.totalText = result.extractedContent.text.length;

      console.log('\n✅ Analysis complete!');
      
    } catch (error) {
      console.error('❌ Error during analysis:', error);
      result.error = error.message;
    }

    return result;
  }

  /**
   * Process individual slide with all media
   * @param {Object} slide - Slide data
   * @param {Object} mediaFiles - Media files from presentation
   * @returns {Promise<Object>} Processed slide content
   */
  async processSlide(slide, mediaFiles) {
    const slideContent = {
      slideNumber: slide.number,
      isHidden: slide.isHidden || false,
      text: [],
      images: [],
      videos: [],
      shapes: []
    };

    // Extract text content
    console.log('  📝 Extracting text...');
    for (const text of slide.texts) {
      if (text.content) {
        slideContent.text.push({
          content: text.content,
          formatting: text.formatting
        });
      }
    }

    // Process shapes
    for (const shape of slide.shapes) {
      if (shape.text) {
        slideContent.shapes.push({
          name: shape.name,
          text: shape.text,
          type: shape.type
        });
      }
    }

    // Process images
    if (slide.images.length > 0) {
      console.log(`  📷 Analyzing ${slide.images.length} images...`);
      for (const imageRef of slide.images) {
        const imageFile = mediaFiles.images.find(img => 
          imageRef.path.includes(path.basename(img.filename))
        );
        
        if (imageFile) {
          const analysis = await this.analyzeImage(imageFile.path, {
            slideNumber: slide.number,
            imageName: imageRef.name
          });
          slideContent.images.push(analysis);
        }
      }
    }

    // Process videos
    if (slide.videos.length > 0) {
      console.log(`  🎥 Transcribing ${slide.videos.length} videos...`);
      for (const videoRef of slide.videos) {
        const videoFile = mediaFiles.videos.find(vid => 
          videoRef.path.includes(path.basename(vid.filename))
        );
        
        if (videoFile) {
          const transcription = await this.transcribeVideo(videoFile.path, {
            slideNumber: slide.number
          });
          slideContent.videos.push(transcription);
        }
      }
    }

    return slideContent;
  }

  /**
   * Analyze image with full OCR and visual description
   * @param {string} imagePath - Path to image
   * @param {Object} context - Context information
   * @returns {Promise<Object>} Image analysis
   */
  async analyzeImage(imagePath, context) {
    const analysis = await this.imageAnalyzer.analyzeImage(imagePath, context);
    
    return {
      filename: analysis.filename,
      slideNumber: context.slideNumber,
      name: context.imageName,
      ocr: {
        text: analysis.analysis.ocr.text || '[No text found]',
        confidence: analysis.analysis.ocr.confidence
      },
      visual: {
        description: analysis.analysis.visual.description,
        fullAnalysis: analysis.analysis.combined.fullDescription
      }
    };
  }

  /**
   * Transcribe video with audio and visual analysis
   * @param {string} videoPath - Path to video
   * @param {Object} context - Context information
   * @returns {Promise<Object>} Video transcription
   */
  async transcribeVideo(videoPath, context) {
    const transcription = await this.mediaTranscriber.transcribeVideo(videoPath);
    
    return {
      filename: transcription.filename,
      slideNumber: context.slideNumber,
      duration: transcription.duration,
      audio: {
        transcription: transcription.audio.transcription,
        language: transcription.audio.language
      },
      visual: {
        keyFrames: transcription.visual.keyFrames,
        sceneDescriptions: transcription.visual.sceneDescriptions
      },
      combined: transcription.combined
    };
  }

  /**
   * Generate full transcription document
   * @param {Object} analysis - Complete analysis results
   * @returns {string} Full transcription
   */
  generateFullTranscription(analysis) {
    let transcription = '';

    // Header
    transcription += '# COMPLETE DOCUMENT TRANSCRIPTION\n\n';
    transcription += `Document: ${analysis.metadata.title || 'Untitled'}\n`;
    transcription += `Author: ${analysis.metadata.creator || 'Unknown'}\n`;
    transcription += `Created: ${analysis.metadata.created || 'Unknown'}\n`;
    transcription += `Total Slides: ${analysis.summary.totalSlides}\n\n`;
    transcription += '---\n\n';

    // Process each slide
    for (const slide of analysis.slides) {
      transcription += `## SLIDE ${slide.slideNumber}${slide.isHidden ? ' [HIDDEN]' : ''}\n\n`;

      // Text content
      if (slide.text.length > 0) {
        transcription += '### TEXT CONTENT\n';
        for (const text of slide.text) {
          transcription += `${text.content}\n`;
        }
        transcription += '\n';
      }

      // Shape text
      if (slide.shapes.length > 0) {
        transcription += '### SHAPES AND OBJECTS\n';
        for (const shape of slide.shapes) {
          transcription += `- ${shape.name}: ${shape.text}\n`;
        }
        transcription += '\n';
      }

      // Images
      if (slide.images.length > 0) {
        transcription += '### IMAGES\n';
        for (const image of slide.images) {
          transcription += `\n**Image: ${image.name || image.filename}**\n`;
          
          // OCR text
          if (image.ocr.text) {
            transcription += `- **Text in image**: "${image.ocr.text}" (Confidence: ${image.ocr.confidence}%)\n`;
          }
          
          // Visual description
          transcription += `- **Visual description**: ${image.visual.description}\n`;
          transcription += `- **Full analysis**: ${image.visual.fullAnalysis}\n`;
        }
        transcription += '\n';
      }

      // Videos
      if (slide.videos.length > 0) {
        transcription += '### VIDEOS\n';
        for (const video of slide.videos) {
          transcription += `\n**Video: ${video.filename}** (Duration: ${video.duration}s)\n`;
          
          // Audio transcription
          transcription += `- **Audio transcription**: ${video.audio.transcription}\n`;
          
          // Visual description
          if (video.visual.sceneDescriptions.length > 0) {
            transcription += `- **Visual content**: ${video.visual.sceneDescriptions[0].description}\n`;
          }
          
          // Combined narrative
          if (video.combined.narrative) {
            transcription += `- **Combined narrative**: ${video.combined.narrative}\n`;
          }
        }
        transcription += '\n';
      }

      transcription += '---\n\n';
    }

    // Add processing notes
    transcription += '\n## PROCESSING NOTES\n\n';
    
    if (!analysis.metadata.whisperApiKey && !analysis.metadata.visionApiKey) {
      transcription += '⚠️ **Note**: Full transcription requires API keys:\n';
      transcription += '- Audio transcription requires OPENAI_API_KEY for Whisper API\n';
      transcription += '- Visual analysis requires OPENAI_API_KEY for Vision API\n';
      transcription += '- OCR is performed locally using Tesseract.js\n';
    }

    return transcription;
  }

  /**
   * Save analysis results to file
   * @param {Object} analysis - Analysis results
   * @param {string} outputPath - Output file path
   */
  async saveAnalysis(analysis, outputPath) {
    const format = path.extname(outputPath).toLowerCase();

    if (format === '.json') {
      await fs.writeFile(outputPath, JSON.stringify(analysis, null, 2));
    } else {
      // Default to markdown
      await fs.writeFile(outputPath, analysis.fullTranscription);
    }

    console.log(`\n💾 Analysis saved to: ${outputPath}`);
  }
}

/**
 * Quick analysis function
 */
export async function analyzeDocumentComplete(filePath, options = {}) {
  const analyzer = new ComprehensiveAnalyzer(options);
  const analysis = await analyzer.analyzeDocument(filePath);
  
  // Save results
  const outputName = path.basename(filePath, path.extname(filePath));
  const outputPath = path.join(
    'output/final',
    `${outputName}_COMPLETE_TRANSCRIPTION.md`
  );
  
  await analyzer.saveAnalysis(analysis, outputPath);
  
  // Also save JSON version
  const jsonPath = path.join(
    'output/final',
    `${outputName}_COMPLETE_ANALYSIS.json`
  );
  await analyzer.saveAnalysis(analysis, jsonPath);
  
  return analysis;
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const filePath = process.argv[2];
  
  if (!filePath) {
    console.log('Usage: node comprehensive-analyzer.js <document-path>');
    process.exit(1);
  }

  analyzeDocumentComplete(filePath)
    .then(() => console.log('\n✅ Complete!'))
    .catch(console.error);
}

export default ComprehensiveAnalyzer;