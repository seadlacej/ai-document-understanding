# CLAUDE.md

This file provides guidance to Claude Code for PowerPoint document analysis using Gemini analyzers.

## Document Processing Workflow

### 1. Initial Setup and Logging

- Check for PPTX files in the `uploads/` folder (Note: Only process files uploaded by the user - never add files to this directory)
- **IMPORTANT**: All temporary files created during analysis MUST be placed in the `/temp` directory, not in the root folder
- Create individual log file for this analysis session:
  ```bash
  # Create timestamped log file
  touch logs/[YYYYMMDDHHMMSS].log
  ```
- Log all processing steps with detailed timestamps
- All console outputs must be written to the log file

### 2. Content Extraction Process

#### MCP Tools Priority:

Use MCPs (Model Context Protocol) servers for extraction:

1. **office-powerpoint MCP**: For PowerPoint structure, text, hidden text, comments, and metadata extraction
2. **filesystem MCP**: For file operations
3. **document-forge MCP**: For any document conversions needed

#### For Each PPTX Document:

##### A. Create Output Directory

```bash
# Create timestamped output directory
mkdir -p output/[YYYYMMDDHHMMSS_filename_with_underlines]/
```

##### B. Extract All Content

**Phase 1: Slide Image Generation**

- Check if LibreOffice is installed using `src/utils/libreoffice-converter.js`
- If available:
  - Convert each slide to high-quality PNG image
  - Save as `slides/slide_001.png`, `slides/slide_002.png`, etc.
  - Preserves complete visual layout including diagrams, arrows, and spatial relationships
- If not available:
  - Use basic text extraction from PPTX parser
  - Note: This will miss visual relationships and complex layouts

**Phase 2: Media Extraction**

- Extract all embedded images and videos
- Copy media files to output directory
- Maintain slide-to-media relationships

**LOG**: Document extraction started, number of slides, LibreOffice availability, media files found

##### C. Analyze Slide Content with Gemini

**If slide images were generated:**

1. Send each slide image to Gemini for comprehensive visual analysis
2. Gemini will extract ALL text and understand visual layout
3. Get complete understanding of slide structure and relationships

**If LibreOffice not available:**

1. Basic text analysis only
2. Limited understanding of visual relationships
3. Recommend installing LibreOffice for better results

**LOG**: Each slide content analysis

##### D. Process Images (One at a Time)

For each extracted image:

1. Save image to output directory
2. Analyze using `src/utils/gemini-image-analyzer.js`
3. Record which slide and text block the image relates to
4. Combine with slide content analysis for context
5. Log the analysis results

**LOG**: Each image processing step and results

##### E. Process Videos (One at a Time)

For each extracted video:

1. Save video to output directory
2. Analyze using `src/utils/gemini-video-analyzer.js`
3. Record which slide and text block the video relates to
4. Combine with slide content analysis for context
5. Log the analysis results

**LOG**: Each video processing step and results

### 3. Media-Text Relationship Tracking

For each media file, maintain clear relationships:

- Source slide number
- Related text block or content on the slide
- Position/context within the slide
- Purpose (illustration, data visualization, example, etc.)

### 4. Final Output Structure

```
output/
└── YYYYMMDDHHMMSS_filename_with_underlines/
    ├── slides/                    (if LibreOffice available)
    │   ├── slide_001.png
    │   ├── slide_002.png
    │   └── ...
    ├── image_001.png
    ├── image_002.jpg
    ├── video_001.mp4
    ├── video_002.avi
    ├── ... (all extracted media files)
    └── result.md
```

### 5. Result.md Format

```markdown
# Complete Analysis: [filename]

## Document Information

- Filename: [filename]
- Type: PPTX
- Date Processed: [YYYY-MM-DD HH:MM:SS]
- Total Slides: [N]
- Total Images: [N]
- Total Videos: [N]

## Slide-by-Slide Analysis

### Slide 1: [Title if available]

**Text Content:**
[All text from slide including hidden text, formatted as it appears]

**Speaker Notes:**
[Any speaker notes for this slide]

**Comments:**
[Any comments on this slide]

**Image 1** (image_001.png)

- **Related to:** [Specify which text block or section this image relates to]
- **Context:** [How this image relates to the slide content]
- **Gemini Analysis:**
  - Extracted Text: [Complete text found in image]
  - Description: [What the image shows]
  - Language: [detected language]
  - Confidence: [high/medium/low]
  - Layout: [presentation/document/screenshot/photo/diagram]

**Video 1** (video_001.mp4)

- **Related to:** [Specify which text block or section this video relates to]
- **Context:** [How this video relates to the slide content]
- **Duration:** [duration]
- **Gemini Analysis:**
  - Audio Transcription: [Complete word-for-word transcription]
  - Visual Description: [What happens in the video]
  - Scenes: [Scene-by-scene breakdown with timestamps]
  - Language: [detected language]

### Slide 2: [Title if available]

[Continue same format for all slides...]
```

### 6. Logging Format

Create detailed logs in `/logs/[YYYYMMDDHHMMSS].log`:

```
[YYYY-MM-DD HH:MM:SS] Processing started for: [filename]
[YYYY-MM-DD HH:MM:SS] Created output directory: output/[YYYYMMDDHHMMSS_filename_with_underlines]/
[YYYY-MM-DD HH:MM:SS] Using office-powerpoint MCP to extract content...
[YYYY-MM-DD HH:MM:SS] Found [N] slides, [X] images, [Y] videos
[YYYY-MM-DD HH:MM:SS] Extracting slide 1 content...
[YYYY-MM-DD HH:MM:SS] Found image on slide 1 related to text block: "[text snippet]"
[YYYY-MM-DD HH:MM:SS] Processing image_001.png with Gemini analyzer...
[YYYY-MM-DD HH:MM:SS] Gemini extracted [N] words from image_001.png
[YYYY-MM-DD HH:MM:SS] Processing video_001.mp4 with Gemini analyzer...
[YYYY-MM-DD HH:MM:SS] Gemini transcribed [N] words from video_001.mp4
[YYYY-MM-DD HH:MM:SS] ERROR: [Any error messages with full details]
[YYYY-MM-DD HH:MM:SS] Writing final analysis to: output/[YYYYMMDDHHMMSS_filename_with_underlines]/result.md
[YYYY-MM-DD HH:MM:SS] Processing completed. Total duration: [X] seconds
[YYYY-MM-DD HH:MM:SS] Media files copied: [N] images, [M] videos
```

### 7. Implementation Guidelines

1. **Sequential Processing**: Process images and videos one at a time, not in batches
2. **Relationship Tracking**: Always maintain clear relationships between media and slide content
3. **Complete Extraction**: Extract ALL content - never summarize or skip
4. **Error Handling**: Log all errors with complete details, continue processing other files
5. **Media Preservation**: Copy all media files to output directory before analysis

### 8. Gemini Analyzer Integration

#### Image Analysis (`src/utils/gemini-image-analyzer.js`):

- Provides complete text extraction from images
- Returns detailed description of image content
- Detects language and layout type
- No additional OCR needed - Gemini handles all text extraction

#### Video Analysis (`src/utils/gemini-video-analyzer.js`):

- Provides complete audio transcription
- Analyzes visual content scene by scene
- Extracts any text visible in video frames
- Returns timestamps for all content

### 9. Complete Analysis Flow

1. **Initialize** → Create timestamped log file
2. **Create Output Directory** → `output/YYYYMMDDHHMMSS_filename_with_underlines/`
3. **Check LibreOffice** → Verify if slide image generation is available
4. **Generate Slide Images** → Convert PPTX slides to PNG images (if LibreOffice available)
5. **Extract and Copy Media Files** → Save all images and videos to output directory
6. **Analyze Slide Images** → Send each slide image to Gemini for analysis
7. **Analyze Media Images** → Process each extracted image with Gemini analyzer
8. **Analyze Videos** → Process each video with Gemini analyzer
9. **Compile Results** → Create comprehensive `result.md` combining all analyses
10. **Log Completion** → Record final statistics and duration

**Note**: All temporary files created during analysis (scripts, intermediate files, etc.) MUST be placed in the `/temp` directory, never in the root folder. The `/temp` directory should be cleaned manually when needed.

## LibreOffice Installation

### For Local Development (macOS):

```bash
# Install using Homebrew
brew install libreoffice

# Verify installation
npm run check:libreoffice
```

### For Docker/Coolify Deployment:

LibreOffice is automatically included in the Dockerfile. No manual installation needed.

```bash
# Build Docker image
npm run docker:build

# Run with Docker
npm run docker:run
```

## Benefits of LibreOffice Slide Image Approach

This approach provides the best understanding of presentation content:

1. **Visual Preservation**: Generates actual slide images preserving exact layouts
2. **Complete Context**: Maintains all spatial relationships, arrows, and visual connections
3. **Perfect for Complex Slides**: Captures diagrams, SmartArt, charts, and visual hierarchies
4. **Gemini Understanding**: AI can analyze slides as humans see them
5. **No Missing Content**: Everything visible on the slide is captured

## Important Notes

- Never add files to `uploads/` - it's exclusively for user uploads
- **All temporary analysis files MUST be created in `/temp` directory, not in the root folder**
- Process media files sequentially to ensure accurate analysis
- Maintain clear relationships between media and slide content
- Log every step with timestamps for debugging
- The Gemini analyzers handle all text extraction - no additional tools needed
- LibreOffice provides the best visual understanding of slide content
