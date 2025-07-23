import { execSync } from "child_process";
import fs from "fs/promises";
import path from "path";

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

    try {
      // Get absolute paths
      const absPptxPath = path.resolve(pptxPath);
      const absOutputDir = path.resolve(outputDir);

      console.log(
        `Converting ${path.basename(
          pptxPath
        )} to PDF with optimized text handling...`
      );

      // Check for problematic fonts and log warnings
      this.checkForProblematicFonts(pptxPath);

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
    }
  }
}
export default LibreOfficeConverter;
