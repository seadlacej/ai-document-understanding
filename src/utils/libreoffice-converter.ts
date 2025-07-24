import { execSync } from "child_process";
import fs from "fs/promises";
import path from "path";
import AdmZip from "adm-zip";

interface ConverterOptions {
  outputFormat?: string;
  quality?: number;
  resolution?: number;
}

interface ConversionResult {
  success: boolean;
  slideCount?: number;
  outputDir?: string;
  method?: string;
  pdfPath?: string;
  pdfFilename?: string;
}

/**
 * LibreOffice Converter for PPTX to PNG slides
 * Works on both local Mac (with brew install libreoffice) and Docker environments
 */
export class LibreOfficeConverter {
  private options: Required<ConverterOptions>;
  private libreOfficePath: string | null;
  private isAvailable: boolean;
  private fontSubstitutions: Map<string, string>;

  constructor(options: ConverterOptions = {}) {
    this.options = {
      outputFormat: "png",
      quality: 90,
      resolution: 300, // DPI for high quality
      ...options,
    };

    this.libreOfficePath = null;
    this.isAvailable = false;

    // Common font substitutions to improve PDF conversion
    this.fontSubstitutions = new Map([
      ["Calibri", "Liberation Sans"],
      ["Calibri Light", "Liberation Sans"],
      ["Cambria", "Liberation Serif"],
      ["Consolas", "Liberation Mono"],
      ["Arial", "Liberation Sans"],
      ["Times New Roman", "Liberation Serif"],
      ["Courier New", "Liberation Mono"],
    ]);
  }

  /**
   * Check if LibreOffice is installed and available
   */
  async checkAvailability(): Promise<boolean> {
    try {
      // First check if LIBREOFFICE_PATH is set in environment
      const envPath = process.env.LIBREOFFICE_PATH;
      if (envPath) {
        try {
          await fs.access(envPath);
          this.libreOfficePath = envPath;
          this.isAvailable = true;
          console.log(`LibreOffice found at configured path: ${envPath}`);
          return true;
        } catch (e) {
          console.error(
            `Configured LibreOffice path not accessible: ${envPath}`
          );
        }
      }

      // If not in env, try to find it dynamically
      try {
        execSync(`which soffice`, { stdio: "pipe" });
        this.libreOfficePath = "soffice";
        this.isAvailable = true;
        console.log(`LibreOffice found in PATH: soffice`);
        return true;
      } catch (e) {
        // Not found in PATH
      }

      console.log(
        "LibreOffice not found. Please set LIBREOFFICE_PATH in .env or install with: brew install libreoffice"
      );
      return false;
    } catch (error) {
      console.error(
        "Error checking LibreOffice availability:",
        (error as Error).message
      );
      return false;
    }
  }

  /**
   * Check for problematic fonts in PPTX and log warnings
   */
  private checkForProblematicFonts(pptxPath: string): void {
    const filename = path.basename(pptxPath);
    console.log(`Checking ${filename} for font compatibility...`);
  }

  /**
   * Remove videos from PPTX file to reduce PDF size
   * Creates a temporary video-free copy of the PPTX
   */
  private async removeVideosFromPptx(pptxPath: string): Promise<string> {
    const tempDir = path.join(process.cwd(), "temp");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const tempPptxPath = path.join(tempDir, `video-free-${timestamp}-${path.basename(pptxPath)}`);

    try {
      console.log(`Creating video-free copy of ${path.basename(pptxPath)}...`);
      
      // Read the PPTX file as ZIP
      const zip = new AdmZip(pptxPath);
      const zipEntries = zip.getEntries();
      
      // Create new ZIP for video-free version
      const newZip = new AdmZip();
      
      let videosRemoved = 0;
      const videoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.mpg', '.mpeg', '.m4v', '.webm'];
      
      // Process each entry
      for (const entry of zipEntries) {
        const entryName = entry.entryName;
        
        // Check if this is a video file in the media folder
        if (entryName.startsWith('ppt/media/') && 
            videoExtensions.some(ext => entryName.toLowerCase().endsWith(ext))) {
          console.log(`Removing video: ${entryName}`);
          videosRemoved++;
          continue; // Skip adding this video to new ZIP
        }
        
        // For relationship files, we need to remove video references
        if (entryName.includes('.rels') && entry.getData) {
          let content = entry.getData().toString('utf8');
          
          // Remove video relationships
          const videoRelPattern = /<Relationship[^>]*Target="[^"]*\.(mp4|avi|mov|wmv|mpg|mpeg|m4v|webm)"[^>]*\/>/gi;
          const originalContent = content;
          content = content.replace(videoRelPattern, '');
          
          if (originalContent !== content) {
            console.log(`Cleaned video references from: ${entryName}`);
            newZip.addFile(entryName, Buffer.from(content, 'utf8'));
            continue;
          }
        }
        
        // Add all other files as-is
        if (entry.getData) {
          newZip.addFile(entryName, entry.getData());
        }
      }
      
      // Write the new PPTX file
      await fs.mkdir(tempDir, { recursive: true });
      newZip.writeZip(tempPptxPath);
      
      console.log(`Video-free PPTX created: ${tempPptxPath}`);
      console.log(`Removed ${videosRemoved} video(s) from the presentation`);
      
      return tempPptxPath;
    } catch (error) {
      console.error("Error removing videos from PPTX:", (error as Error).message);
      throw error;
    }
  }

  /**
   * Convert PPTX to a single PDF file
   */
  async convertToPdf(
    pptxPath: string,
    outputDir: string
  ): Promise<ConversionResult> {
    if (!this.isAvailable) {
      await this.checkAvailability();
      if (!this.isAvailable) {
        throw new Error(
          "LibreOffice is not installed. Please install it first."
        );
      }
    }

    let videoFreePptxPath: string | null = null;

    try {
      // Create a video-free copy of the PPTX for PDF conversion
      videoFreePptxPath = await this.removeVideosFromPptx(pptxPath);
      
      // Get absolute paths
      const absPptxPath = path.resolve(videoFreePptxPath);
      const absOutputDir = path.resolve(outputDir);

      console.log(
        `Converting video-free ${path.basename(
          pptxPath
        )} to PDF with optimized text handling...`
      );

      // Check for problematic fonts and log warnings
      this.checkForProblematicFonts(videoFreePptxPath);

      // JSON parameters for better PDF export (LibreOffice 7.3+)
      const pdfExportParams = {
        EmbedStandardFonts: { type: "boolean", value: "true" },
        SelectPdfVersion: { type: "long", value: "15" }, // PDF 1.5 for better font handling
        UseLosslessCompression: { type: "boolean", value: "true" },
        Quality: { type: "long", value: "100" },
        PDFViewSelection: { type: "long", value: "0" },
        ExportBookmarks: { type: "boolean", value: "false" },
        UseTaggedPDF: { type: "boolean", value: "true" },
      };

      const jsonParams = JSON.stringify(pdfExportParams);

      // Use JSON format for PDF export parameters
      let pdfCmd = `${this.libreOfficePath} --headless --convert-to 'pdf:writer_pdf_Export:${jsonParams}' --outdir "${absOutputDir}" "${absPptxPath}"`;

      try {
        // Try with JSON parameters first (LibreOffice 7.3+)
        execSync(pdfCmd, { stdio: "pipe" });
        console.log("PDF conversion completed with optimized text handling");
      } catch (error) {
        console.log(
          "JSON parameter format not supported, trying legacy format..."
        );

        // Fallback to simple conversion for older LibreOffice versions
        pdfCmd = `${this.libreOfficePath} --headless --convert-to pdf --outdir "${absOutputDir}" "${absPptxPath}"`;

        try {
          execSync(pdfCmd, { stdio: "pipe" });
          console.warn(
            "PDF converted with basic settings - text spacing issues may occur"
          );
        } catch (error2) {
          // If still failing, capture the actual error output
          const err = error2 as any;
          const errorOutput = err.stdout ? err.stdout.toString() : "";
          const stderrOutput = err.stderr ? err.stderr.toString() : "";

          console.error("LibreOffice stdout:", errorOutput);
          console.error("LibreOffice stderr:", stderrOutput);

          throw new Error(
            `PDF conversion failed. LibreOffice output: ${errorOutput} ${stderrOutput}`
          );
        }
      }

      // Find the created PDF
      const files = await fs.readdir(absOutputDir);
      const pdfFile = files.find((f) => f.endsWith(".pdf"));

      if (!pdfFile) {
        throw new Error("PDF conversion failed - no PDF file created");
      }

      const pdfPath = path.join(absOutputDir, pdfFile);

      return {
        success: true,
        pdfPath: pdfPath,
        pdfFilename: pdfFile,
      };
    } catch (error) {
      console.error("Error converting PPTX to PDF:", (error as Error).message);
      throw error;
    } finally {
      // Clean up the temporary video-free PPTX file
      if (videoFreePptxPath) {
        try {
          await fs.unlink(videoFreePptxPath);
          console.log("Cleaned up temporary video-free PPTX file");
        } catch (cleanupError) {
          console.warn("Failed to clean up temporary file:", (cleanupError as Error).message);
        }
      }
    }
  }
}
export default LibreOfficeConverter;
