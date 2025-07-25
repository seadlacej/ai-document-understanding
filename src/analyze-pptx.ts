#!/usr/bin/env node

import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { LibreOfficeConverter } from "./utils/libreoffice-converter.js";
import { GeminiPDFAnalyzer } from "./utils/gemini-pdf-analyzer.js";
import { GeminiImageAnalyzer } from "./utils/gemini-image-analyzer.js";
import { GeminiVideoAnalyzer } from "./utils/gemini-video-analyzer.js";
import AdmZip from "adm-zip";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get file path from command line argument
const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node analyze-pptx.js <path-to-pptx-file>");
  process.exit(1);
}

// Generate timestamp and output directory name
const timestamp = new Date()
  .toISOString()
  .replace(/[-:.TZ]/g, "")
  .slice(0, 14);
const fullFilename = path.basename(filePath, ".pptx");

// Remove UUID prefix if present (format: uuid_originalname)
const filename = fullFilename.includes("_")
  ? fullFilename.substring(fullFilename.indexOf("_") + 1)
  : fullFilename;

const outputDirName = `${timestamp}_${filename.replace(/\s+/g, "_")}`;
const outputDir = path.join(process.cwd(), "output", outputDirName);

// Create log file
const logDir = path.join(process.cwd(), "logs");
await fs.mkdir(logDir, { recursive: true });
const logFile = path.join(logDir, `${timestamp}.log`);

// Media file types
interface MediaFile {
  name: string;
  path: string;
  extension: string;
  slideNumber: number | string;
}

interface ExtractedMedia {
  images: MediaFile[];
  videos: MediaFile[];
}

interface ImageAnalysisResult {
  filename: string;
  pageNumber: number | string;
  analysis: {
    text?: string;
    extractedText?: string;
    description?: string;
    language?: string;
    confidence?: string;
    error?: string;
  };
}

interface VideoAnalysisResult {
  filename: string;
  pageNumber: number | string;
  analysis: {
    transcription?: string;
    description?: string;
    duration?: number;
    scenes?: Array<{
      timestamp?: string;
      startTime?: string;
      endTime?: string;
      description: string;
    }>;
    language?: string;
    error?: string;
  };
}

interface PDFPageAnalysis {
  pageNumber: number;
  extractedText: string;
  title?: string;
  bulletPoints?: string[];
  visualElements?: {
    hasCharts: boolean;
    hasDiagrams: boolean;
    hasImages: boolean;
    hasFlowchart: boolean;
    description: string;
  };
  language?: string;
  keyTopics?: string[];
  relationships?: string;
  error?: string;
}

interface PageContent {
  pageNumber: number;
  pdfContent: PDFPageAnalysis;
  images: Array<{
    filename: string;
    extractedText?: string;
    description?: string;
    language?: string;
    confidence?: string;
    error?: string;
  }>;
  videos: Array<{
    filename: string;
    transcription?: string;
    description?: string;
    duration?: number;
    scenes?: Array<{
      timestamp?: string;
      startTime?: string;
      endTime?: string;
      description: string;
    }>;
    language?: string;
    error?: string;
  }>;
}

interface ResultData {
  filename: string;
  timestamp: string;
  pageCount: number | string;
  imageCount: number;
  videoCount: number;
  pdfAnalysis: {
    text?: string;
    error?: string;
    pageCount?: number;
    pages?: PDFPageAnalysis[];
  };
  imageAnalyses: ImageAnalysisResult[];
  videoAnalyses: VideoAnalysisResult[];
}

// Logging function
async function log(message: string): Promise<void> {
  const timestampedMessage = `[${new Date().toISOString()}] ${message}`;
  console.log(timestampedMessage);
  await fs.appendFile(logFile, timestampedMessage + "\n");
}

async function main(): Promise<void> {
  try {
    await log(`Processing started for: ${filename}`);
    await log(`Created output directory: ${outputDirName}`);

    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });

    // Create temp directory for extracted media
    const tempDir = path.join(process.cwd(), "temp", timestamp);
    await fs.mkdir(tempDir, { recursive: true });

    // Phase 1: Media Extraction
    await log("Phase 1: Extracting media from PPTX...");
    const extractedMedia = await extractMediaFromPPTX(filePath, tempDir);
    await log(
      `Found ${extractedMedia.images.length} images, ${extractedMedia.videos.length} videos`
    );

    // Phase 1.5: Change fonts to Arial
    await log("Phase 1.5: Changing all fonts to Arial...");
    const modifiedPptxPath = path.join(tempDir, `${filename}_arial.pptx`);
    try {
      await changeFontsToArial(filePath, modifiedPptxPath);
      await log("Font conversion to Arial completed");
    } catch (fontError) {
      await log(
        `WARNING: Font conversion failed: ${(fontError as Error).message}`
      );
      await log("Continuing with original file...");
      // Copy original file if font conversion fails
      await fs.copyFile(filePath, modifiedPptxPath);
    }

    // Phase 2: PDF Generation
    await log("Phase 2: Converting PPTX to PDF...");
    const converter = new LibreOfficeConverter();
    const isLibreOfficeAvailable = await converter.checkAvailability();

    if (!isLibreOfficeAvailable) {
      throw new Error("LibreOffice is not installed. Cannot convert to PDF.");
    }

    const pdfResult = await converter.convertToPdf(modifiedPptxPath, outputDir);
    if (!pdfResult.pdfPath) {
      throw new Error("PDF conversion failed - no PDF path returned");
    }
    const pdfPath = pdfResult.pdfPath;
    await log(`PDF created: ${pdfResult.pdfFilename}`);

    // Phase 3: Process Images
    await log("Phase 3: Processing extracted images...");
    const imageAnalyzer = new GeminiImageAnalyzer();
    const imageAnalyses: ImageAnalysisResult[] = [];

    for (let i = 0; i < extractedMedia.images.length; i++) {
      const image = extractedMedia.images[i];
      await log(
        `Processing image ${i + 1}/${extractedMedia.images.length}: ${
          image.name
        }`
      );

      try {
        const result = await imageAnalyzer.analyzeImage(image.path);

        const extractedText = result.analysis?.extractedText || "";

        await fs.copyFile(image.path, path.join(outputDir, image.name));

        const analysis = {
          text: extractedText,
          extractedText: result.analysis?.extractedText,
          description: result.analysis?.description,
        } as ImageAnalysisResult["analysis"];

        if (result.error) {
          analysis.error = result.error;
        }

        imageAnalyses.push({
          filename: path.basename(image.name),
          pageNumber: image.slideNumber,
          analysis,
        });
        await log(
          `Gemini extracted ${extractedText.split(" ").length} words from ${
            image.name
          }`
        );
      } catch (error) {
        await log(
          `ERROR: Failed to analyze image ${image.name}: ${
            (error as Error).message
          }`
        );
      }
    }

    // Phase 4: Process Videos
    await log("Phase 4: Processing extracted videos...");
    const videoAnalyzer = new GeminiVideoAnalyzer();
    const videoAnalyses: VideoAnalysisResult[] = [];

    for (let i = 0; i < extractedMedia.videos.length; i++) {
      const video = extractedMedia.videos[i];
      await log(
        `Processing video ${i + 1}/${extractedMedia.videos.length}: ${
          video.name
        }`
      );

      try {
        await fs.copyFile(video.path, path.join(outputDir, video.name));

        const result = await videoAnalyzer.analyzeVideo(video.path);

        const analysis = {
          transcription:
            (result as any).transcription ||
            result.analysis?.audioTranscription,
          description:
            (result as any).description || result.analysis?.visualDescription,
          duration: result.analysis?.duration,
          scenes: result.analysis?.scenes,
          language: result.analysis?.language,
        } as VideoAnalysisResult["analysis"];

        if (result.error) {
          analysis.error = result.error;
        }

        videoAnalyses.push({
          filename: path.basename(video.name),
          pageNumber: video.slideNumber,
          analysis,
        });

        if (result.analysis?.audioTranscription) {
          await log(
            `Gemini transcribed ${
              result.analysis?.audioTranscription.split(" ").length
            } words from ${video.name}`
          );
        }
      } catch (error) {
        await log(
          `ERROR: Failed to analyze video ${video.name}: ${
            (error as Error).message
          }`
        );
      }
    }

    // Phase 5: Analyze PDF with Gemini (with media context)
    await log("Phase 5: Analyzing PDF with Gemini (with media context)...");
    const pdfAnalyzer = new GeminiPDFAnalyzer();

    // Prepare media context for PDF analysis
    const mediaContext = {
      images: imageAnalyses.map((img) => ({
        filename: img.filename,
        pageNumber: img.pageNumber,
        extractedText: img.analysis.extractedText,
        description: img.analysis.description,
        language: img.analysis.language,
      })),
      videos: videoAnalyses.map((vid) => ({
        filename: vid.filename,
        pageNumber: vid.pageNumber,
        transcription: vid.analysis.transcription,
        description: vid.analysis.description,
        duration: vid.analysis.duration,
        scenes: vid.analysis.scenes,
        language: vid.analysis.language,
      })),
    };

    const pdfAnalysis = await pdfAnalyzer.analyzePDF(pdfPath, { mediaContext });

    await log(
      `PDF analysis completed. Extracted ${
        pdfAnalysis.text?.split(" ").length
      } words`
    );

    // Create final result.md
    await log("Creating final analysis report...");
    await createResultMarkdown(outputDir, {
      filename,
      timestamp: new Date().toISOString(),
      pageCount: pdfAnalysis.pageCount || "Unknown",
      imageCount: imageAnalyses.length,
      videoCount: videoAnalyses.length,
      pdfAnalysis,
      imageAnalyses,
      videoAnalyses,
    });

    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });

    await log(
      `Processing completed. Total duration: ${Math.round(
        (Date.now() - new Date(timestamp).getTime()) / 1000
      )} seconds`
    );
    await log(
      `Media files copied: ${imageAnalyses.length} images, ${videoAnalyses.length} videos`
    );
  } catch (error) {
    await log(`ERROR: ${(error as Error).message}`);
    await log(`Full error: ${(error as Error).stack || ""}`);
    throw error;
  }
}

async function changeFontsToArial(
  inputPath: string,
  outputPath: string
): Promise<void> {
  const zip = new AdmZip(inputPath);
  const entries = zip.getEntries();

  // Process each entry
  for (const entry of entries) {
    const entryName = entry.entryName;

    // Check if this is a slide or theme XML file
    if (
      (entryName.startsWith("ppt/slides/slide") &&
        entryName.endsWith(".xml")) ||
      (entryName.startsWith("ppt/theme/theme") && entryName.endsWith(".xml")) ||
      (entryName.startsWith("ppt/slideMasters/") &&
        entryName.endsWith(".xml")) ||
      (entryName.startsWith("ppt/slideLayouts/") && entryName.endsWith(".xml"))
    ) {
      // Get the XML content
      const xmlContent = entry.getData().toString("utf8");

      // Replace font references
      let modifiedContent = xmlContent;

      // Replace typeface attributes
      modifiedContent = modifiedContent.replace(
        /typeface="[^"]*"/g,
        'typeface="Arial"'
      );

      // Replace specific font tags
      modifiedContent = modifiedContent.replace(
        /<a:latin\s+typeface="[^"]*"/g,
        '<a:latin typeface="Arial"'
      );
      modifiedContent = modifiedContent.replace(
        /<a:ea\s+typeface="[^"]*"/g,
        '<a:ea typeface="Arial"'
      );
      modifiedContent = modifiedContent.replace(
        /<a:cs\s+typeface="[^"]*"/g,
        '<a:cs typeface="Arial"'
      );

      // Replace font tags with other attributes (preserve attributes)
      modifiedContent = modifiedContent.replace(
        /<a:latin([^>]*?)typeface="[^"]*"([^>]*?)>/g,
        '<a:latin$1typeface="Arial"$2>'
      );
      modifiedContent = modifiedContent.replace(
        /<a:ea([^>]*?)typeface="[^"]*"([^>]*?)>/g,
        '<a:ea$1typeface="Arial"$2>'
      );
      modifiedContent = modifiedContent.replace(
        /<a:cs([^>]*?)typeface="[^"]*"([^>]*?)>/g,
        '<a:cs$1typeface="Arial"$2>'
      );

      // Update the entry with modified content
      zip.updateFile(entry.entryName, Buffer.from(modifiedContent, "utf8"));
    }
  }

  // Write the modified PPTX to the output path
  zip.writeZip(outputPath);
}

async function extractMediaFromPPTX(
  pptxPath: string,
  tempDir: string
): Promise<ExtractedMedia> {
  const zip = new AdmZip(pptxPath);
  const entries = zip.getEntries();
  const media: ExtractedMedia = { images: [], videos: [] };

  const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".svg"];
  const videoExtensions = [".mp4", ".avi", ".mov", ".wmv", ".mkv"];

  try {
    // First, build a map of media files to slide numbers by parsing relationships
    const mediaToSlideMap = await buildMediaToSlideMap(zip);

    for (const entry of entries) {
      if (entry.entryName.includes("ppt/media/")) {
        const extension = path.extname(entry.entryName).toLowerCase();
        const name = path.basename(entry.entryName);

        if (imageExtensions.includes(extension)) {
          const outputPath = path.join(tempDir, name);
          await fs.writeFile(outputPath, entry.getData());

          // Get slide number from our mapping
          const slideNumber = mediaToSlideMap[name] || "Unknown";

          media.images.push({
            name,
            path: outputPath,
            extension: extension.slice(1),
            slideNumber,
          });
        } else if (videoExtensions.includes(extension)) {
          const outputPath = path.join(tempDir, name);
          await fs.writeFile(outputPath, entry.getData());

          const slideNumber = mediaToSlideMap[name] || "Unknown";

          media.videos.push({
            name,
            path: outputPath,
            extension: extension.slice(1),
            slideNumber,
          });
        }
      }
    }
  } catch (error) {
    Promise.reject(
      `Failed to extract media from PPTX: ${(error as Error).message}`
    );
  }

  return media;
}

async function buildMediaToSlideMap(
  zip: AdmZip
): Promise<{ [key: string]: number }> {
  const mediaToSlideMap: { [key: string]: number } = {};
  const entries = zip.getEntries();

  try {
    // Process each slide's relationship file
    for (const entry of entries) {
      if (entry.entryName.match(/ppt\/slides\/_rels\/slide(\d+)\.xml\.rels$/)) {
        const slideNumber = parseInt(entry.entryName.match(/slide(\d+)/)![1]);
        const relsContent = entry.getData().toString("utf8");

        // Parse the XML to find media relationships
        // Look for Target attributes that point to media files
        const mediaMatches = relsContent.matchAll(
          /Target="\.\.\/(media\/[^"]+)"/g
        );

        for (const match of mediaMatches) {
          const mediaPath = match[1]; // e.g., "media/image1.png"
          const mediaName = path.basename(mediaPath);
          mediaToSlideMap[mediaName] = slideNumber;
        }
      }
    }
  } catch (error) {
    throw new Error(
      `Failed to build media to slide map: ${(error as Error).message}`
    );
  }

  return mediaToSlideMap;
}

async function createResultMarkdown(
  outputDir: string,
  data: ResultData
): Promise<void> {
  const {
    filename,
    timestamp,
    pageCount,
    imageCount,
    videoCount,
    pdfAnalysis,
    imageAnalyses,
    videoAnalyses,
  } = data;

  // Build page-based content structure
  const pageContents: PageContent[] = [];

  // Process each page from PDF analysis
  if (pdfAnalysis.pages) {
    for (const pdfPage of pdfAnalysis.pages) {
      // Find all images for this page
      const pageImages = imageAnalyses
        .filter((img) => img.pageNumber === pdfPage.pageNumber)
        .map((img) => ({
          filename: img.filename,
          extractedText: img.analysis.extractedText,
          description: img.analysis.description,
          language: img.analysis.language,
          confidence: img.analysis.confidence,
          error: img.analysis.error,
        }));

      // Find all videos for this page
      const pageVideos = videoAnalyses
        .filter((vid) => vid.pageNumber === pdfPage.pageNumber)
        .map((vid) => ({
          filename: vid.filename,
          transcription: vid.analysis.transcription,
          description: vid.analysis.description,
          duration: vid.analysis.duration,
          scenes: vid.analysis.scenes,
          language: vid.analysis.language,
          error: vid.analysis.error,
        }));

      // Create page content object
      const pageContent: PageContent = {
        pageNumber: pdfPage.pageNumber,
        pdfContent: pdfPage,
        images: pageImages,
        videos: pageVideos,
      };

      pageContents.push(pageContent);
    }
  }

  // Create markdown with embedded JSON
  const markdown = `# Complete Analysis: ${filename}

## Document Information

- Filename: ${filename}.pptx
- Type: PPTX
- Date Processed: ${timestamp}
- Total Pages: ${pageCount}
- Total Images: ${imageCount}
- Total Videos: ${videoCount}

## Analysis Results (JSON)

\`\`\`json
${JSON.stringify(pageContents, null, 2)}
\`\`\`
`;

  await fs.writeFile(path.join(outputDir, "result.md"), markdown);
}

// Run the main function
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
