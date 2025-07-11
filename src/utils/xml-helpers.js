import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import readline from 'readline';

/**
 * Helper functions for handling large XML files efficiently
 */

/**
 * Stream-based XML text extractor
 * Extracts text content from specific XML tags without loading entire file into memory
 */
export class XMLTextExtractor {
  constructor(options = {}) {
    this.options = {
      maxBufferSize: options.maxBufferSize || 1024 * 1024, // 1MB default
      encoding: options.encoding || 'utf8',
      ...options
    };
  }

  /**
   * Extract text from XML file using streaming
   * @param {string} filePath - Path to XML file
   * @param {string} tagName - XML tag to extract text from (e.g., 'a:t')
   * @returns {Promise<Array>} Array of extracted text objects
   */
  async extractTextFromTag(filePath, tagName) {
    const results = [];
    const tagPattern = new RegExp(`<${tagName}[^>]*>([^<]*)<\/${tagName}>`, 'g');
    const stream = createReadStream(filePath, { encoding: this.options.encoding });
    
    let buffer = '';
    
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => {
        buffer += chunk;
        
        // Process buffer when it gets large enough
        if (buffer.length > this.options.maxBufferSize) {
          const matches = buffer.matchAll(tagPattern);
          for (const match of matches) {
            results.push({
              text: match[1],
              position: match.index
            });
          }
          
          // Keep the last part of buffer to handle tags split across chunks
          const lastTagStart = buffer.lastIndexOf('<');
          buffer = lastTagStart > -1 ? buffer.slice(lastTagStart) : '';
        }
      });
      
      stream.on('end', () => {
        // Process remaining buffer
        const matches = buffer.matchAll(tagPattern);
        for (const match of matches) {
          results.push({
            text: match[1],
            position: match.index
          });
        }
        resolve(results);
      });
      
      stream.on('error', reject);
    });
  }

  /**
   * Extract text with context (surrounding XML)
   * @param {string} filePath - Path to XML file
   * @param {string} searchPattern - Pattern to search for
   * @param {number} contextLines - Number of lines before/after to include
   * @returns {Promise<Array>} Array of matches with context
   */
  async extractWithContext(filePath, searchPattern, contextLines = 2) {
    const results = [];
    const fileStream = createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    const buffer = [];
    let lineNumber = 0;
    const pattern = new RegExp(searchPattern, 'i');

    for await (const line of rl) {
      buffer.push({ lineNumber, content: line });
      
      // Keep buffer size limited
      if (buffer.length > contextLines * 2 + 1) {
        buffer.shift();
      }

      if (pattern.test(line)) {
        const startIdx = Math.max(0, buffer.length - contextLines - 1);
        const context = buffer.slice(startIdx);
        
        results.push({
          match: line,
          lineNumber,
          context: context.map(item => ({
            line: item.lineNumber,
            content: item.content
          }))
        });
      }

      lineNumber++;
    }

    return results;
  }

  /**
   * Count occurrences of a pattern in large XML file
   * @param {string} filePath - Path to XML file
   * @param {string} pattern - Pattern to count
   * @returns {Promise<number>} Count of occurrences
   */
  async countOccurrences(filePath, pattern) {
    const regex = new RegExp(pattern, 'g');
    let count = 0;

    const countStream = new Transform({
      transform(chunk, encoding, callback) {
        const matches = chunk.toString().match(regex);
        if (matches) {
          count += matches.length;
        }
        callback();
      }
    });

    await pipeline(
      createReadStream(filePath),
      countStream
    );

    return count;
  }
}

/**
 * Process large XML files in chunks
 */
export class XMLChunkProcessor {
  constructor(options = {}) {
    this.options = {
      chunkSize: options.chunkSize || 1000, // lines per chunk
      ...options
    };
  }

  /**
   * Process XML file in chunks with a callback function
   * @param {string} filePath - Path to XML file
   * @param {Function} processChunk - Function to process each chunk
   * @returns {Promise<Array>} Combined results from all chunks
   */
  async processInChunks(filePath, processChunk) {
    const results = [];
    const fileStream = createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let chunk = [];
    let chunkNumber = 0;

    for await (const line of rl) {
      chunk.push(line);

      if (chunk.length >= this.options.chunkSize) {
        const chunkResult = await processChunk(chunk, chunkNumber);
        if (chunkResult) {
          results.push(chunkResult);
        }
        chunk = [];
        chunkNumber++;
      }
    }

    // Process remaining lines
    if (chunk.length > 0) {
      const chunkResult = await processChunk(chunk, chunkNumber);
      if (chunkResult) {
        results.push(chunkResult);
      }
    }

    return results.flat();
  }

  /**
   * Extract specific elements from large XML file
   * @param {string} filePath - Path to XML file
   * @param {string} elementPath - XPath-like element path (e.g., 'p:sp/p:txBody/a:p/a:r/a:t')
   * @returns {Promise<Array>} Extracted elements
   */
  async extractElements(filePath, elementPath) {
    const pathParts = elementPath.split('/');
    const targetElement = pathParts[pathParts.length - 1];
    const results = [];

    await this.processInChunks(filePath, async (chunk) => {
      const chunkText = chunk.join('\n');
      const elementRegex = new RegExp(`<${targetElement}[^>]*>([^<]*)<\/${targetElement}>`, 'g');
      const matches = chunkText.matchAll(elementRegex);
      
      const chunkResults = [];
      for (const match of matches) {
        chunkResults.push({
          element: targetElement,
          content: match[1],
          fullMatch: match[0]
        });
      }
      
      return chunkResults;
    });

    return results;
  }
}

/**
 * XML file analyzer for understanding structure
 */
export class XMLAnalyzer {
  /**
   * Analyze XML file structure without loading entire file
   * @param {string} filePath - Path to XML file
   * @param {number} sampleSize - Number of lines to sample
   * @returns {Promise<Object>} Analysis results
   */
  static async analyzeStructure(filePath, sampleSize = 1000) {
    const stats = await fs.stat(filePath);
    const fileStream = createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    const analysis = {
      fileSize: stats.size,
      elements: new Map(),
      namespaces: new Set(),
      lineCount: 0,
      estimatedTotalLines: 0
    };

    let lineCount = 0;
    const elementRegex = /<([a-zA-Z0-9:]+)(?:\s|>)/g;
    const namespaceRegex = /xmlns:?([a-zA-Z0-9]+)?="([^"]+)"/g;

    for await (const line of rl) {
      // Extract elements
      const elementMatches = line.matchAll(elementRegex);
      for (const match of elementMatches) {
        const element = match[1];
        analysis.elements.set(element, (analysis.elements.get(element) || 0) + 1);
      }

      // Extract namespaces
      const namespaceMatches = line.matchAll(namespaceRegex);
      for (const match of namespaceMatches) {
        analysis.namespaces.add(`${match[1] || 'default'}=${match[2]}`);
      }

      lineCount++;
      if (lineCount >= sampleSize) break;
    }

    analysis.lineCount = lineCount;
    analysis.estimatedTotalLines = Math.round((stats.size / (lineCount * 50)) * lineCount); // Rough estimate

    // Convert Map to object for easier use
    analysis.elements = Object.fromEntries(analysis.elements);
    analysis.namespaces = Array.from(analysis.namespaces);

    return analysis;
  }

  /**
   * Find specific patterns in large XML file
   * @param {string} filePath - Path to XML file
   * @param {Array<string>} patterns - Array of patterns to search for
   * @returns {Promise<Object>} Search results
   */
  static async findPatterns(filePath, patterns) {
    const results = {};
    for (const pattern of patterns) {
      results[pattern] = [];
    }

    const fileStream = createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let lineNumber = 0;

    for await (const line of rl) {
      lineNumber++;
      
      for (const pattern of patterns) {
        if (line.includes(pattern)) {
          results[pattern].push({
            lineNumber,
            preview: line.substring(0, 200) + (line.length > 200 ? '...' : '')
          });
        }
      }
    }

    return results;
  }
}

/**
 * Utility functions for common XML operations
 */
export const XMLUtils = {
  /**
   * Clean extracted XML text
   * @param {string} text - Raw text from XML
   * @returns {string} Cleaned text
   */
  cleanText(text) {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  },

  /**
   * Extract attribute value from XML element
   * @param {string} element - XML element string
   * @param {string} attribute - Attribute name
   * @returns {string|null} Attribute value or null
   */
  getAttributeValue(element, attribute) {
    const regex = new RegExp(`${attribute}="([^"]*)"`, 'i');
    const match = element.match(regex);
    return match ? match[1] : null;
  },

  /**
   * Check if file is likely XML based on first few bytes
   * @param {string} filePath - Path to file
   * @returns {Promise<boolean>} True if likely XML
   */
  async isXMLFile(filePath) {
    const buffer = Buffer.alloc(100);
    const fileHandle = await fs.open(filePath, 'r');
    
    try {
      await fileHandle.read(buffer, 0, 100, 0);
      const content = buffer.toString('utf8');
      return content.includes('<?xml') || content.includes('<');
    } finally {
      await fileHandle.close();
    }
  },

  /**
   * Estimate memory usage for loading XML file
   * @param {string} filePath - Path to XML file
   * @returns {Promise<Object>} Memory usage estimate
   */
  async estimateMemoryUsage(filePath) {
    const stats = await fs.stat(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    return {
      fileSize: stats.size,
      fileSizeMB: fileSizeMB.toFixed(2),
      estimatedMemoryMB: (fileSizeMB * 2.5).toFixed(2), // XML parsing typically uses 2-3x file size
      recommendation: fileSizeMB > 50 ? 'Use streaming' : 'Can load in memory'
    };
  }
};

export default {
  XMLTextExtractor,
  XMLChunkProcessor,
  XMLAnalyzer,
  XMLUtils
};