import AdmZip from 'adm-zip';
import { parseStringPromise } from 'xml2js';
import path from 'path';
import fs from 'fs/promises';

/**
 * PPTX Parser for extracting content from PowerPoint presentations
 * Handles text, images, videos, and hidden slides
 */
export class PPTXParser {
  constructor(options = {}) {
    this.options = {
      tempDir: options.tempDir || './temp',
      extractMedia: options.extractMedia !== false,
      extractHiddenSlides: options.extractHiddenSlides !== false,
      ...options
    };
  }

  /**
   * Parse a PPTX file and extract all content
   * @param {string} filePath - Path to the PPTX file
   * @returns {Promise<Object>} Extracted content with metadata
   */
  async parse(filePath) {
    const startTime = Date.now();
    const result = {
      metadata: {},
      slides: [],
      media: {
        images: [],
        videos: [],
        audio: []
      },
      notes: [],
      hiddenSlides: []
    };

    try {
      // Extract PPTX contents
      const zip = new AdmZip(filePath);
      const tempExtractPath = path.join(this.options.tempDir, `pptx_${Date.now()}`);
      await fs.mkdir(tempExtractPath, { recursive: true });
      
      zip.extractAllTo(tempExtractPath, true);

      // Extract metadata
      result.metadata = await this.extractMetadata(tempExtractPath);

      // Extract presentation structure
      const presentationData = await this.extractPresentationData(tempExtractPath);
      
      // Extract slides content
      const slideFiles = await this.getSlideFiles(tempExtractPath);
      for (const slideFile of slideFiles) {
        const slide = await this.extractSlideContent(tempExtractPath, slideFile, presentationData);
        if (slide.isHidden && this.options.extractHiddenSlides) {
          result.hiddenSlides.push(slide);
        } else if (!slide.isHidden) {
          result.slides.push(slide);
        }
      }

      // Extract media files
      if (this.options.extractMedia) {
        result.media = await this.extractMediaFiles(tempExtractPath);
      }

      // Extract notes
      result.notes = await this.extractNotes(tempExtractPath);

      // Clean up temp directory
      await fs.rm(tempExtractPath, { recursive: true, force: true });

      result.processingTime = Date.now() - startTime;
      return result;

    } catch (error) {
      throw new Error(`Failed to parse PPTX: ${error.message}`);
    }
  }

  /**
   * Extract metadata from the PPTX file
   */
  async extractMetadata(extractPath) {
    const metadata = {};
    
    try {
      const corePath = path.join(extractPath, 'docProps', 'core.xml');
      const appPath = path.join(extractPath, 'docProps', 'app.xml');

      // Core properties
      if (await this.fileExists(corePath)) {
        const coreXml = await fs.readFile(corePath, 'utf8');
        const coreData = await parseStringPromise(coreXml);
        const props = coreData['cp:coreProperties'];
        
        metadata.title = this.extractValue(props['dc:title']);
        metadata.creator = this.extractValue(props['dc:creator']);
        metadata.lastModifiedBy = this.extractValue(props['cp:lastModifiedBy']);
        metadata.created = this.extractValue(props['dcterms:created']);
        metadata.modified = this.extractValue(props['dcterms:modified']);
      }

      // App properties
      if (await this.fileExists(appPath)) {
        const appXml = await fs.readFile(appPath, 'utf8');
        const appData = await parseStringPromise(appXml);
        const props = appData['Properties'];
        
        metadata.slides = parseInt(this.extractValue(props['Slides']) || 0);
        metadata.hiddenSlides = parseInt(this.extractValue(props['HiddenSlides']) || 0);
      }

    } catch (error) {
      console.error('Error extracting metadata:', error);
    }

    return metadata;
  }

  /**
   * Extract presentation-level data (relationships, hidden slides, etc.)
   */
  async extractPresentationData(extractPath) {
    const data = {
      slideLayouts: {},
      hiddenSlides: new Set(),
      slideRelationships: {}
    };

    try {
      // Read presentation.xml
      const presPath = path.join(extractPath, 'ppt', 'presentation.xml');
      const presXml = await fs.readFile(presPath, 'utf8');
      const presData = await parseStringPromise(presXml);

      // Find hidden slides
      const slideList = presData['p:presentation']['p:sldIdLst']?.[0]?.['p:sldId'] || [];
      slideList.forEach(slide => {
        if (slide.$ && slide.$.show === '0') {
          data.hiddenSlides.add(slide.$.id);
        }
      });

      // Read relationships
      const relsPath = path.join(extractPath, 'ppt', '_rels', 'presentation.xml.rels');
      if (await this.fileExists(relsPath)) {
        const relsXml = await fs.readFile(relsPath, 'utf8');
        const relsData = await parseStringPromise(relsXml);
        const relationships = relsData['Relationships']['Relationship'] || [];
        
        relationships.forEach(rel => {
          if (rel.$.Type.includes('slide')) {
            const slideId = rel.$.Id;
            const slidePath = rel.$.Target;
            data.slideRelationships[slideId] = slidePath;
          }
        });
      }

    } catch (error) {
      console.error('Error extracting presentation data:', error);
    }

    return data;
  }

  /**
   * Get all slide files in the presentation
   */
  async getSlideFiles(extractPath) {
    const slidesPath = path.join(extractPath, 'ppt', 'slides');
    const files = await fs.readdir(slidesPath);
    return files
      .filter(file => file.match(/^slide\d+\.xml$/))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)[0]);
        const numB = parseInt(b.match(/\d+/)[0]);
        return numA - numB;
      });
  }

  /**
   * Extract content from a single slide
   */
  async extractSlideContent(extractPath, slideFile, presentationData) {
    const slideNumber = parseInt(slideFile.match(/\d+/)[0]);
    const slidePath = path.join(extractPath, 'ppt', 'slides', slideFile);
    
    const slide = {
      number: slideNumber,
      isHidden: false,
      texts: [],
      shapes: [],
      images: [],
      videos: [],
      animations: []
    };

    try {
      const slideXml = await fs.readFile(slidePath, 'utf8');
      const slideData = await parseStringPromise(slideXml);

      // Check if slide is hidden
      const slideId = slideData['p:sld']?.['$']?.['show'];
      if (slideId === '0' || presentationData.hiddenSlides.has(slideId)) {
        slide.isHidden = true;
      }

      // Extract texts
      slide.texts = await this.extractTextsFromSlide(slideData);

      // Extract shapes and images
      const shapes = this.findElements(slideData, 'p:sp');
      const pics = this.findElements(slideData, 'p:pic');

      // Process shapes
      for (const shape of shapes) {
        const shapeInfo = await this.extractShapeInfo(shape);
        if (shapeInfo) slide.shapes.push(shapeInfo);
      }

      // Process images
      for (const pic of pics) {
        const imageInfo = await this.extractImageInfo(pic, extractPath, slideNumber);
        if (imageInfo) slide.images.push(imageInfo);
      }

      // Extract animations
      slide.animations = await this.extractAnimations(extractPath, slideNumber);

      // Extract media references
      const mediaRefs = await this.extractMediaReferences(extractPath, slideNumber);
      slide.videos = mediaRefs.videos;
      slide.audio = mediaRefs.audio;

    } catch (error) {
      console.error(`Error extracting slide ${slideNumber}:`, error);
    }

    return slide;
  }

  /**
   * Extract all text content from a slide
   */
  async extractTextsFromSlide(slideData) {
    const texts = [];
    const textElements = this.findElements(slideData, 'a:t');

    for (const element of textElements) {
      if (typeof element === 'string') {
        texts.push({
          content: element,
          formatting: {}
        });
      } else if (element._) {
        texts.push({
          content: element._,
          formatting: this.extractTextFormatting(element.$)
        });
      }
    }

    return texts;
  }

  /**
   * Extract shape information
   */
  async extractShapeInfo(shape) {
    const info = {
      type: 'shape',
      name: shape['p:nvSpPr']?.[0]?.['p:cNvPr']?.[0]?.$.name || 'Unknown',
      text: '',
      properties: {}
    };

    // Extract text from shape
    const texts = this.findElements(shape, 'a:t');
    info.text = texts.map(t => typeof t === 'string' ? t : t._ || '').join(' ');

    // Extract shape properties
    const spPr = shape['p:spPr']?.[0];
    if (spPr) {
      info.properties = {
        geometry: spPr['a:prstGeom']?.[0]?.$.prst,
        fill: this.extractFillInfo(spPr['a:solidFill']?.[0])
      };
    }

    return info;
  }

  /**
   * Extract image information
   */
  async extractImageInfo(pic, extractPath, slideNumber) {
    const info = {
      type: 'image',
      name: pic['p:nvPicPr']?.[0]?.['p:cNvPr']?.[0]?.$.name || 'Unknown',
      slideNumber,
      path: '',
      properties: {}
    };

    // Get image relationship ID
    const blip = pic['p:blipFill']?.[0]?.['a:blip']?.[0];
    if (blip && blip.$) {
      const embedId = blip.$['r:embed'];
      if (embedId) {
        // Find the actual image file
        const relsPath = path.join(extractPath, 'ppt', 'slides', '_rels', `slide${slideNumber}.xml.rels`);
        if (await this.fileExists(relsPath)) {
          const relsXml = await fs.readFile(relsPath, 'utf8');
          const relsData = await parseStringPromise(relsXml);
          const relationships = relsData['Relationships']['Relationship'] || [];
          
          const imageRel = relationships.find(rel => rel.$.Id === embedId);
          if (imageRel) {
            info.path = imageRel.$.Target;
          }
        }
      }
    }

    return info;
  }

  /**
   * Extract animations from a slide
   */
  async extractAnimations(extractPath, slideNumber) {
    // Animation data would be in slide relationships or timing information
    // This is a placeholder for animation extraction logic
    return [];
  }

  /**
   * Extract media references (videos, audio) from a slide
   */
  async extractMediaReferences(extractPath, slideNumber) {
    const media = { videos: [], audio: [] };
    
    try {
      const relsPath = path.join(extractPath, 'ppt', 'slides', '_rels', `slide${slideNumber}.xml.rels`);
      if (await this.fileExists(relsPath)) {
        const relsXml = await fs.readFile(relsPath, 'utf8');
        const relsData = await parseStringPromise(relsXml);
        const relationships = relsData['Relationships']['Relationship'] || [];
        
        for (const rel of relationships) {
          if (rel.$.Type.includes('video')) {
            media.videos.push({
              id: rel.$.Id,
              path: rel.$.Target,
              slideNumber
            });
          } else if (rel.$.Type.includes('audio')) {
            media.audio.push({
              id: rel.$.Id,
              path: rel.$.Target,
              slideNumber
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error extracting media references from slide ${slideNumber}:`, error);
    }

    return media;
  }

  /**
   * Extract all media files from the presentation
   */
  async extractMediaFiles(extractPath) {
    const media = { images: [], videos: [], audio: [] };
    const mediaPath = path.join(extractPath, 'ppt', 'media');

    try {
      if (await this.fileExists(mediaPath)) {
        const files = await fs.readdir(mediaPath);
        
        for (const file of files) {
          const filePath = path.join(mediaPath, file);
          const stats = await fs.stat(filePath);
          
          const fileInfo = {
            filename: file,
            path: filePath,
            size: stats.size,
            type: path.extname(file).toLowerCase()
          };

          if (file.match(/\.(jpg|jpeg|png|gif|bmp|svg)$/i)) {
            media.images.push(fileInfo);
          } else if (file.match(/\.(mp4|avi|mov|wmv|flv|mkv)$/i)) {
            media.videos.push(fileInfo);
          } else if (file.match(/\.(mp3|wav|ogg|m4a|aac)$/i)) {
            media.audio.push(fileInfo);
          }
        }
      }
    } catch (error) {
      console.error('Error extracting media files:', error);
    }

    return media;
  }

  /**
   * Extract notes from slides
   */
  async extractNotes(extractPath) {
    const notes = [];
    const notesPath = path.join(extractPath, 'ppt', 'notesSlides');

    try {
      if (await this.fileExists(notesPath)) {
        const files = await fs.readdir(notesPath);
        const noteFiles = files.filter(file => file.match(/^notesSlide\d+\.xml$/));

        for (const noteFile of noteFiles) {
          const slideNumber = parseInt(noteFile.match(/\d+/)[0]);
          const notePath = path.join(notesPath, noteFile);
          const noteXml = await fs.readFile(notePath, 'utf8');
          const noteData = await parseStringPromise(noteXml);
          
          const texts = this.findElements(noteData, 'a:t');
          const noteText = texts.map(t => typeof t === 'string' ? t : t._ || '').join(' ');
          
          if (noteText.trim()) {
            notes.push({
              slideNumber,
              text: noteText.trim()
            });
          }
        }
      }
    } catch (error) {
      console.error('Error extracting notes:', error);
    }

    return notes;
  }

  // Helper methods

  /**
   * Find elements in XML structure recursively
   */
  findElements(obj, tagName, results = []) {
    if (!obj || typeof obj !== 'object') return results;

    if (Array.isArray(obj)) {
      obj.forEach(item => this.findElements(item, tagName, results));
    } else {
      if (obj[tagName]) {
        if (Array.isArray(obj[tagName])) {
          results.push(...obj[tagName]);
        } else {
          results.push(obj[tagName]);
        }
      }
      
      Object.keys(obj).forEach(key => {
        if (key !== tagName && typeof obj[key] === 'object') {
          this.findElements(obj[key], tagName, results);
        }
      });
    }

    return results;
  }

  /**
   * Extract value from XML element
   */
  extractValue(element) {
    if (!element) return '';
    if (Array.isArray(element)) element = element[0];
    if (typeof element === 'string') return element;
    if (element._) return element._;
    if (element['#text']) return element['#text'];
    return '';
  }

  /**
   * Extract text formatting information
   */
  extractTextFormatting(attrs) {
    if (!attrs) return {};
    
    return {
      bold: attrs.b === '1',
      italic: attrs.i === '1',
      underline: attrs.u !== 'none',
      fontSize: attrs.sz ? parseInt(attrs.sz) / 100 : undefined,
      fontFamily: attrs.typeface
    };
  }

  /**
   * Extract fill information
   */
  extractFillInfo(fill) {
    if (!fill) return null;
    
    if (fill['a:srgbClr']) {
      return {
        type: 'solid',
        color: fill['a:srgbClr'][0].$.val
      };
    }
    
    return null;
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export default PPTXParser;