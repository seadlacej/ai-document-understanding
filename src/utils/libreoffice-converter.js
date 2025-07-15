import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

/**
 * LibreOffice Converter for PPTX to PNG slides
 * Works on both local Mac (with brew install libreoffice) and Docker environments
 */
export class LibreOfficeConverter {
  constructor(options = {}) {
    this.options = {
      outputFormat: 'png',
      quality: 90,
      resolution: 300, // DPI for high quality
      ...options
    };
    
    this.libreOfficePath = null;
    this.isAvailable = false;
  }

  /**
   * Check if LibreOffice is installed and available
   */
  async checkAvailability() {
    try {
      // Check common LibreOffice executable names
      const commands = ['soffice', 'libreoffice'];
      
      for (const cmd of commands) {
        try {
          execSync(`which ${cmd}`, { stdio: 'pipe' });
          this.libreOfficePath = cmd;
          this.isAvailable = true;
          console.log(`LibreOffice found: ${cmd}`);
          return true;
        } catch (e) {
          // Try next command
        }
      }
      
      // Check Mac-specific paths
      const macPaths = [
        '/Applications/LibreOffice.app/Contents/MacOS/soffice',
        '/usr/local/bin/soffice',
        '/opt/homebrew/bin/soffice'
      ];
      
      for (const path of macPaths) {
        try {
          await fs.access(path);
          this.libreOfficePath = path;
          this.isAvailable = true;
          console.log(`LibreOffice found at: ${path}`);
          return true;
        } catch (e) {
          // Try next path
        }
      }
      
      console.log('LibreOffice not found. Please install with: brew install libreoffice');
      return false;
      
    } catch (error) {
      console.error('Error checking LibreOffice availability:', error.message);
      return false;
    }
  }

  /**
   * Convert PPTX to individual slide images
   */
  async convertToSlideImages(pptxPath, outputDir) {
    if (!this.isAvailable) {
      await this.checkAvailability();
      if (!this.isAvailable) {
        throw new Error('LibreOffice is not installed. Please install it first.');
      }
    }

    try {
      // Create output directories
      const slidesDir = path.join(outputDir, 'slides');
      await fs.mkdir(slidesDir, { recursive: true });
      
      // Get absolute paths
      const absPptxPath = path.resolve(pptxPath);
      const absSlidesDir = path.resolve(slidesDir);
      
      console.log(`Converting ${path.basename(pptxPath)} to slide images...`);
      
      // Method 1: Direct PNG export (if supported)
      try {
        const result = await this.convertDirectToPng(absPptxPath, absSlidesDir);
        if (result.success) {
          return result;
        }
      } catch (e) {
        console.log('Direct PNG conversion failed, trying PDF method...');
      }
      
      // Method 2: Convert to PDF first, then to PNG
      return await this.convertViaPdf(absPptxPath, absSlidesDir);
      
    } catch (error) {
      console.error('Error converting PPTX to images:', error.message);
      throw error;
    }
  }

  /**
   * Try direct PPTX to PNG conversion
   */
  async convertDirectToPng(pptxPath, outputDir) {
    try {
      // LibreOffice command for direct image export
      const cmd = `${this.libreOfficePath} --headless --convert-to png --outdir "${outputDir}" "${pptxPath}"`;
      
      console.log('Attempting direct PNG conversion...');
      execSync(cmd, { stdio: 'pipe' });
      
      // Check if images were created
      const files = await fs.readdir(outputDir);
      const pngFiles = files.filter(f => f.endsWith('.png'));
      
      if (pngFiles.length > 0) {
        // Rename to standard format
        await this.standardizeImageNames(outputDir);
        
        return {
          success: true,
          slideCount: pngFiles.length,
          outputDir: outputDir,
          method: 'direct'
        };
      }
      
      return { success: false };
      
    } catch (error) {
      console.log('Direct PNG conversion not supported');
      return { success: false };
    }
  }

  /**
   * Convert PPTX to PDF, then extract pages as PNG
   */
  async convertViaPdf(pptxPath, outputDir) {
    const tempDir = path.join(outputDir, '..', 'temp_pdf');
    await fs.mkdir(tempDir, { recursive: true });
    
    try {
      // Step 1: Convert PPTX to PDF
      console.log('Converting PPTX to PDF...');
      const pdfCmd = `${this.libreOfficePath} --headless --convert-to pdf --outdir "${tempDir}" "${pptxPath}"`;
      execSync(pdfCmd, { stdio: 'pipe' });
      
      // Find the created PDF
      const files = await fs.readdir(tempDir);
      const pdfFile = files.find(f => f.endsWith('.pdf'));
      
      if (!pdfFile) {
        throw new Error('PDF conversion failed - no PDF file created');
      }
      
      const pdfPath = path.join(tempDir, pdfFile);
      
      // Step 2: Extract PDF pages as images
      console.log('Extracting PDF pages as PNG images...');
      
      // Try using LibreOffice Draw to convert PDF pages
      const pngCmd = `${this.libreOfficePath} --headless --draw --convert-to png --outdir "${outputDir}" "${pdfPath}"`;
      
      try {
        execSync(pngCmd, { stdio: 'pipe' });
      } catch (e) {
        // If LibreOffice can't do it, we'd need to use another tool
        console.log('LibreOffice PDF to PNG conversion failed');
        
        // Alternative: Use ImageMagick if available
        try {
          execSync('which convert', { stdio: 'pipe' });
          console.log('Using ImageMagick for PDF to PNG conversion...');
          const imageMagickCmd = `convert -density ${this.options.resolution} "${pdfPath}" -quality ${this.options.quality} "${outputDir}/slide_%03d.png"`;
          execSync(imageMagickCmd, { stdio: 'pipe' });
        } catch (e2) {
          throw new Error('No suitable PDF to PNG converter found. Install ImageMagick with: brew install imagemagick');
        }
      }
      
      // Check results and standardize names
      const pngFiles = await fs.readdir(outputDir);
      const slideImages = pngFiles.filter(f => f.endsWith('.png'));
      
      if (slideImages.length === 0) {
        throw new Error('No slide images were created');
      }
      
      await this.standardizeImageNames(outputDir);
      
      return {
        success: true,
        slideCount: slideImages.length,
        outputDir: outputDir,
        method: 'pdf'
      };
      
    } finally {
      // Clean up temp directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (e) {
        console.warn('Could not clean up temp directory:', e.message);
      }
    }
  }

  /**
   * Standardize image names to slide_001.png format
   */
  async standardizeImageNames(outputDir) {
    const files = await fs.readdir(outputDir);
    const pngFiles = files.filter(f => f.endsWith('.png')).sort();
    
    for (let i = 0; i < pngFiles.length; i++) {
      const oldName = path.join(outputDir, pngFiles[i]);
      const newName = path.join(outputDir, `slide_${String(i + 1).padStart(3, '0')}.png`);
      
      if (oldName !== newName) {
        await fs.rename(oldName, newName);
      }
    }
  }

  /**
   * Get slide count from a PPTX file
   */
  async getSlideCount(pptxPath) {
    // This would require parsing the PPTX structure
    // For now, we'll count after conversion
    return -1;
  }

  /**
   * Clean up any temporary files
   */
  async cleanup() {
    // Cleanup is handled in individual methods
  }
}

/**
 * Main conversion function
 */
export async function convertPptxToSlideImages(pptxPath, outputDir) {
  const converter = new LibreOfficeConverter();
  
  // Check if LibreOffice is available
  const isAvailable = await converter.checkAvailability();
  
  if (!isAvailable) {
    console.warn(`
LibreOffice is not installed. To enable slide image generation:

For Mac:
  brew install libreoffice

For Docker/Coolify:
  The Dockerfile will include LibreOffice automatically

Falling back to comprehensive text extraction...
`);
    return null;
  }
  
  // Convert slides
  return await converter.convertToSlideImages(pptxPath, outputDir);
}

export default LibreOfficeConverter;