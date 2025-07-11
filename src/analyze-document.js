import { PPTXTextExtractor } from './utils/pptx-text-extractor.js';
import { XMLAnalyzer } from './utils/xml-helpers.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Example usage script for analyzing documents
 * Demonstrates how to use the PPTX parser and text extraction utilities
 */

async function analyzeDocument(filePath) {
  console.log(`\n🔍 Analyzing document: ${path.basename(filePath)}`);
  console.log('='.repeat(60));

  try {
    // Initialize extractor
    const extractor = new PPTXTextExtractor({
      includeNotes: true,
      includeHiddenSlides: true,
      includeShapeNames: true,
      includeMediaDescriptions: true
    });

    // Extract all text content
    console.log('\n📄 Extracting text content...');
    const textContent = await extractor.extractAllText(filePath);

    // Display metadata
    console.log('\n📋 Document Metadata:');
    console.log(`  Title: ${textContent.metadata.title || 'Untitled'}`);
    console.log(`  Author: ${textContent.metadata.creator || 'Unknown'}`);
    console.log(`  Created: ${textContent.metadata.created || 'Unknown'}`);
    console.log(`  Modified: ${textContent.metadata.modified || 'Unknown'}`);

    // Display summary
    console.log('\n📊 Document Summary:');
    console.log(`  Total Slides: ${textContent.summary.totalSlides}`);
    console.log(`  Total Words: ${textContent.summary.totalWords}`);
    console.log(`  Total Characters: ${textContent.summary.totalCharacters}`);
    console.log(`  Has Hidden Content: ${textContent.summary.hasHiddenContent ? 'Yes' : 'No'}`);
    console.log(`  Has Notes: ${textContent.summary.hasNotes ? 'Yes' : 'No'}`);
    console.log(`  Has Media: ${textContent.summary.hasMedia ? 'Yes' : 'No'}`);

    // Display slide content
    console.log('\n📑 Slide Content:');
    for (const slide of textContent.slides) {
      console.log(`\n  Slide ${slide.slideNumber}:`);
      for (const content of slide.content) {
        console.log(`    - ${content.text.substring(0, 100)}${content.text.length > 100 ? '...' : ''}`);
      }
      
      if (slide.images && slide.images.length > 0) {
        console.log(`    📷 Images: ${slide.images.length}`);
      }
      
      if (slide.videos && slide.videos.length > 0) {
        console.log(`    🎥 Videos: ${slide.videos.length}`);
      }
    }

    // Display hidden slides if any
    if (textContent.hiddenContent && textContent.hiddenContent.length > 0) {
      console.log('\n🔒 Hidden Slides:');
      for (const slide of textContent.hiddenContent) {
        console.log(`  Hidden Slide ${slide.slideNumber}: ${slide.content.length} text elements`);
      }
    }

    // Display media descriptions
    if (textContent.mediaDescriptions) {
      console.log('\n🎨 Media Files:');
      
      if (textContent.mediaDescriptions.images.length > 0) {
        console.log('  Images:');
        for (const image of textContent.mediaDescriptions.images) {
          console.log(`    - ${image.filename} (${image.type}, ${(image.size / 1024).toFixed(2)} KB)`);
        }
      }
      
      if (textContent.mediaDescriptions.videos.length > 0) {
        console.log('  Videos:');
        for (const video of textContent.mediaDescriptions.videos) {
          console.log(`    - ${video.filename} (${video.type}, ${(video.size / 1024 / 1024).toFixed(2)} MB)`);
        }
      }
    }

    // Export as plain text
    console.log('\n💾 Exporting as plain text...');
    const plainText = await extractor.exportAsPlainText(filePath);
    const outputPath = filePath.replace(path.extname(filePath), '_extracted.txt');
    await fs.writeFile(outputPath, plainText);
    console.log(`  Saved to: ${path.basename(outputPath)}`);

    // Save detailed JSON output
    const jsonOutputPath = filePath.replace(path.extname(filePath), '_analysis.json');
    await fs.writeFile(jsonOutputPath, JSON.stringify(textContent, null, 2));
    console.log(`  Detailed analysis saved to: ${path.basename(jsonOutputPath)}`);

  } catch (error) {
    console.error('\n❌ Error analyzing document:', error.message);
  }
}

// Example: Search functionality
async function searchInPresentation(filePath, searchTerm) {
  console.log(`\n🔎 Searching for "${searchTerm}" in ${path.basename(filePath)}`);
  console.log('='.repeat(60));

  try {
    const extractor = new PPTXTextExtractor();
    const results = await extractor.searchText(filePath, searchTerm, {
      caseSensitive: false,
      includeContext: true
    });

    if (results.length === 0) {
      console.log('No matches found.');
    } else {
      console.log(`Found ${results.length} matches:\n`);
      for (const result of results) {
        console.log(`  Slide ${result.slideNumber}${result.isHidden ? ' (Hidden)' : ''}:`);
        console.log(`    Context: ${result.context}`);
        console.log('');
      }
    }
  } catch (error) {
    console.error('Error searching document:', error.message);
  }
}

// Example: Progressive extraction for large files
async function analyzeLargeFile(filePath) {
  console.log(`\n📦 Analyzing large file: ${path.basename(filePath)}`);
  console.log('='.repeat(60));

  try {
    const extractor = new PPTXTextExtractor();
    
    const summary = await extractor.extractLargeFileProgressively(filePath, 
      async (slideText, current, total) => {
        const progress = ((current / total) * 100).toFixed(1);
        console.log(`  Processing: ${progress}% (Slide ${current}/${total}) - ${slideText.wordCount} words`);
      }
    );

    console.log('\n✅ Processing complete!');
    console.log(`  Processed slides: ${summary.processedSlides}`);
    console.log(`  Total words: ${summary.totalWords}`);
    
    if (summary.errors.length > 0) {
      console.log(`  Errors: ${summary.errors.length}`);
      for (const error of summary.errors) {
        console.log(`    - Slide ${error.slide}: ${error.error}`);
      }
    }
  } catch (error) {
    console.error('Error processing large file:', error.message);
  }
}

// Example: Analyze XML structure of a slide
async function analyzeSlideStructure(filePath) {
  console.log(`\n🔧 Analyzing XML structure of slides`);
  console.log('='.repeat(60));

  try {
    // First extract the PPTX
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip(filePath);
    const tempPath = `./temp/analysis_${Date.now()}`;
    await fs.mkdir(tempPath, { recursive: true });
    zip.extractAllTo(tempPath, true);

    // Analyze first slide XML
    const slide1Path = path.join(tempPath, 'ppt', 'slides', 'slide1.xml');
    const analysis = await XMLAnalyzer.analyzeStructure(slide1Path, 500);

    console.log('\n📐 Slide 1 XML Structure:');
    console.log(`  File size: ${(analysis.fileSize / 1024).toFixed(2)} KB`);
    console.log(`  Estimated lines: ${analysis.estimatedTotalLines}`);
    console.log(`  Namespaces: ${analysis.namespaces.length}`);
    console.log('\n  Most common elements:');
    
    const sortedElements = Object.entries(analysis.elements)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    for (const [element, count] of sortedElements) {
      console.log(`    ${element}: ${count} occurrences`);
    }

    // Clean up
    await fs.rm(tempPath, { recursive: true, force: true });

  } catch (error) {
    console.error('Error analyzing structure:', error.message);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node analyze-document.js <file.pptx>');
    console.log('  node analyze-document.js <file.pptx> search <term>');
    console.log('  node analyze-document.js <file.pptx> large');
    console.log('  node analyze-document.js <file.pptx> structure');
    process.exit(1);
  }

  const filePath = args[0];
  
  // Check if file exists
  try {
    await fs.access(filePath);
  } catch {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  // Determine action
  if (args[1] === 'search' && args[2]) {
    await searchInPresentation(filePath, args[2]);
  } else if (args[1] === 'large') {
    await analyzeLargeFile(filePath);
  } else if (args[1] === 'structure') {
    await analyzeSlideStructure(filePath);
  } else {
    await analyzeDocument(filePath);
  }
}

// Export functions for use in other scripts
export {
  analyzeDocument,
  searchInPresentation,
  analyzeLargeFile,
  analyzeSlideStructure
};

// Run main if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}