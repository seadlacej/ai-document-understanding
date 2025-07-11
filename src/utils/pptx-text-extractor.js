import { PPTXParser } from '../parsers/pptx-parser.js';
import { XMLTextExtractor, XMLUtils } from './xml-helpers.js';
import path from 'path';
import fs from 'fs/promises';

/**
 * Specialized text extraction utilities for PPTX files
 * Handles complex scenarios like hidden slides, animations, and media descriptions
 */
export class PPTXTextExtractor {
  constructor(options = {}) {
    this.parser = new PPTXParser(options);
    this.xmlExtractor = new XMLTextExtractor(options);
    this.options = {
      includeNotes: options.includeNotes !== false,
      includeHiddenSlides: options.includeHiddenSlides !== false,
      includeShapeNames: options.includeShapeNames !== false,
      includeMediaDescriptions: options.includeMediaDescriptions !== false,
      ...options
    };
  }

  /**
   * Extract all text content from PPTX file
   * @param {string} filePath - Path to PPTX file
   * @returns {Promise<Object>} Structured text content
   */
  async extractAllText(filePath) {
    const result = {
      metadata: {},
      slides: [],
      notes: [],
      hiddenContent: [],
      summary: {
        totalSlides: 0,
        totalWords: 0,
        totalCharacters: 0,
        hasHiddenContent: false,
        hasNotes: false,
        hasMedia: false
      }
    };

    try {
      // Parse PPTX structure
      const pptxData = await this.parser.parse(filePath);
      
      result.metadata = pptxData.metadata;
      result.summary.totalSlides = pptxData.slides.length;
      result.summary.hasHiddenContent = pptxData.hiddenSlides.length > 0;
      result.summary.hasNotes = pptxData.notes.length > 0;
      result.summary.hasMedia = (pptxData.media.images.length + 
                                pptxData.media.videos.length + 
                                pptxData.media.audio.length) > 0;

      // Process visible slides
      for (const slide of pptxData.slides) {
        const slideText = await this.processSlide(slide);
        result.slides.push(slideText);
        result.summary.totalWords += slideText.wordCount;
        result.summary.totalCharacters += slideText.characterCount;
      }

      // Process hidden slides if requested
      if (this.options.includeHiddenSlides && pptxData.hiddenSlides.length > 0) {
        for (const slide of pptxData.hiddenSlides) {
          const slideText = await this.processSlide(slide);
          slideText.isHidden = true;
          result.hiddenContent.push(slideText);
        }
      }

      // Process notes if requested
      if (this.options.includeNotes) {
        result.notes = pptxData.notes;
      }

      // Add media descriptions
      if (this.options.includeMediaDescriptions) {
        result.mediaDescriptions = await this.generateMediaDescriptions(pptxData.media);
      }

    } catch (error) {
      throw new Error(`Failed to extract text from PPTX: ${error.message}`);
    }

    return result;
  }

  /**
   * Process individual slide content
   * @param {Object} slide - Slide data from parser
   * @returns {Object} Processed slide text
   */
  async processSlide(slide) {
    const slideText = {
      slideNumber: slide.number,
      content: [],
      shapes: [],
      wordCount: 0,
      characterCount: 0,
      hasAnimations: slide.animations.length > 0
    };

    // Extract main text content
    for (const text of slide.texts) {
      const cleaned = XMLUtils.cleanText(text.content);
      if (cleaned) {
        slideText.content.push({
          text: cleaned,
          formatting: text.formatting
        });
        slideText.wordCount += cleaned.split(/\s+/).filter(w => w.length > 0).length;
        slideText.characterCount += cleaned.length;
      }
    }

    // Extract shape information if requested
    if (this.options.includeShapeNames) {
      for (const shape of slide.shapes) {
        if (shape.text || shape.name !== 'Unknown') {
          slideText.shapes.push({
            name: shape.name,
            type: shape.type,
            text: XMLUtils.cleanText(shape.text || ''),
            properties: shape.properties
          });
        }
      }
    }

    // Add media references
    if (slide.images.length > 0) {
      slideText.images = slide.images.map(img => ({
        name: img.name,
        path: img.path
      }));
    }

    if (slide.videos.length > 0) {
      slideText.videos = slide.videos.map(vid => ({
        id: vid.id,
        path: vid.path
      }));
    }

    return slideText;
  }

  /**
   * Generate descriptions for media files
   * @param {Object} media - Media data from parser
   * @returns {Object} Media descriptions
   */
  async generateMediaDescriptions(media) {
    const descriptions = {
      images: [],
      videos: [],
      audio: []
    };

    // For images, we'll prepare them for AI analysis
    for (const image of media.images) {
      descriptions.images.push({
        filename: image.filename,
        type: image.type,
        size: image.size,
        needsAnalysis: true,
        placeholder: `[IMAGE: ${image.filename} - Requires visual analysis]`
      });
    }

    // For videos, prepare for transcription
    for (const video of media.videos) {
      descriptions.videos.push({
        filename: video.filename,
        type: video.type,
        size: video.size,
        duration: 'Unknown',
        needsTranscription: true,
        placeholder: `[VIDEO: ${video.filename} - Requires transcription and visual analysis]`
      });
    }

    // For audio files
    for (const audio of media.audio) {
      descriptions.audio.push({
        filename: audio.filename,
        type: audio.type,
        size: audio.size,
        needsTranscription: true,
        placeholder: `[AUDIO: ${audio.filename} - Requires transcription]`
      });
    }

    return descriptions;
  }

  /**
   * Extract text from specific slides only
   * @param {string} filePath - Path to PPTX file
   * @param {Array<number>} slideNumbers - Array of slide numbers to extract
   * @returns {Promise<Array>} Extracted text from specified slides
   */
  async extractFromSlides(filePath, slideNumbers) {
    const allText = await this.extractAllText(filePath);
    return allText.slides.filter(slide => slideNumbers.includes(slide.slideNumber));
  }

  /**
   * Search for text across all slides
   * @param {string} filePath - Path to PPTX file
   * @param {string} searchTerm - Term to search for
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results
   */
  async searchText(filePath, searchTerm, options = {}) {
    const { caseSensitive = false, includeContext = true } = options;
    const results = [];
    const allText = await this.extractAllText(filePath);
    
    const searchRegex = new RegExp(
      searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      caseSensitive ? 'g' : 'gi'
    );

    // Search in visible slides
    for (const slide of allText.slides) {
      for (const content of slide.content) {
        if (searchRegex.test(content.text)) {
          results.push({
            slideNumber: slide.slideNumber,
            text: content.text,
            matches: content.text.match(searchRegex),
            context: includeContext ? this.getContext(content.text, searchTerm) : null
          });
        }
      }
    }

    // Search in hidden slides if available
    if (allText.hiddenContent) {
      for (const slide of allText.hiddenContent) {
        for (const content of slide.content) {
          if (searchRegex.test(content.text)) {
            results.push({
              slideNumber: slide.slideNumber,
              isHidden: true,
              text: content.text,
              matches: content.text.match(searchRegex),
              context: includeContext ? this.getContext(content.text, searchTerm) : null
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Get context around search term
   * @param {string} text - Full text
   * @param {string} searchTerm - Search term
   * @param {number} contextLength - Characters before/after to include
   * @returns {string} Context string
   */
  getContext(text, searchTerm, contextLength = 50) {
    const index = text.toLowerCase().indexOf(searchTerm.toLowerCase());
    if (index === -1) return '';

    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + searchTerm.length + contextLength);
    
    let context = text.substring(start, end);
    if (start > 0) context = '...' + context;
    if (end < text.length) context = context + '...';
    
    return context;
  }

  /**
   * Generate a plain text version of the presentation
   * @param {string} filePath - Path to PPTX file
   * @param {Object} options - Export options
   * @returns {Promise<string>} Plain text content
   */
  async exportAsPlainText(filePath, options = {}) {
    const {
      includeSlideNumbers = true,
      includeSeparators = true,
      includeMetadata = true
    } = options;

    const allText = await this.extractAllText(filePath);
    let output = '';

    // Add metadata if requested
    if (includeMetadata) {
      output += '=== PRESENTATION METADATA ===\n';
      output += `Title: ${allText.metadata.title || 'Untitled'}\n`;
      output += `Author: ${allText.metadata.creator || 'Unknown'}\n`;
      output += `Created: ${allText.metadata.created || 'Unknown'}\n`;
      output += `Modified: ${allText.metadata.modified || 'Unknown'}\n`;
      output += `Total Slides: ${allText.summary.totalSlides}\n`;
      output += '\n';
    }

    // Add slide content
    for (const slide of allText.slides) {
      if (includeSeparators) {
        output += '='.repeat(50) + '\n';
      }
      
      if (includeSlideNumbers) {
        output += `SLIDE ${slide.slideNumber}\n`;
        if (includeSeparators) {
          output += '-'.repeat(50) + '\n';
        }
      }

      // Add text content
      for (const content of slide.content) {
        output += content.text + '\n';
      }

      // Add shape text if available
      if (slide.shapes && slide.shapes.length > 0) {
        output += '\n[Shapes/Objects]\n';
        for (const shape of slide.shapes) {
          if (shape.text) {
            output += `- ${shape.name}: ${shape.text}\n`;
          }
        }
      }

      // Add media placeholders
      if (slide.images && slide.images.length > 0) {
        output += '\n[Images]\n';
        for (const image of slide.images) {
          output += `- ${image.name}\n`;
        }
      }

      if (slide.videos && slide.videos.length > 0) {
        output += '\n[Videos]\n';
        for (const video of slide.videos) {
          output += `- Video at ${video.path}\n`;
        }
      }

      output += '\n';
    }

    // Add notes if available
    if (allText.notes && allText.notes.length > 0) {
      output += '\n=== SPEAKER NOTES ===\n';
      for (const note of allText.notes) {
        output += `\nSlide ${note.slideNumber}:\n${note.text}\n`;
      }
    }

    // Add hidden content if available
    if (allText.hiddenContent && allText.hiddenContent.length > 0) {
      output += '\n=== HIDDEN SLIDES ===\n';
      for (const slide of allText.hiddenContent) {
        output += `\nHidden Slide ${slide.slideNumber}:\n`;
        for (const content of slide.content) {
          output += content.text + '\n';
        }
      }
    }

    return output;
  }

  /**
   * Extract text from large PPTX files efficiently
   * @param {string} filePath - Path to PPTX file
   * @param {Function} onSlideProcessed - Callback for each processed slide
   * @returns {Promise<Object>} Summary of extraction
   */
  async extractLargeFileProgressively(filePath, onSlideProcessed) {
    const summary = {
      processedSlides: 0,
      totalWords: 0,
      errors: []
    };

    try {
      const pptxData = await this.parser.parse(filePath);
      
      for (const slide of pptxData.slides) {
        try {
          const slideText = await this.processSlide(slide);
          summary.processedSlides++;
          summary.totalWords += slideText.wordCount;
          
          if (onSlideProcessed) {
            await onSlideProcessed(slideText, summary.processedSlides, pptxData.slides.length);
          }
        } catch (error) {
          summary.errors.push({
            slide: slide.number,
            error: error.message
          });
        }
      }
    } catch (error) {
      throw new Error(`Failed to process PPTX: ${error.message}`);
    }

    return summary;
  }
}

export default PPTXTextExtractor;