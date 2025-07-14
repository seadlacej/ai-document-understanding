# CLAUDE.md

This file provides guidance to Claude Code for deep document analysis and understanding.

## Document Processing Workflow with Deep Analysis

### CRITICAL REQUIREMENT: FULL CONTENT TRANSCRIPTION

**ALWAYS extract and transcribe 100% of content from documents:**

- **Text**: Every word, including hidden text, speaker notes, and shape text
- **Images**: Complete OCR of ALL text in images - extract every single word visible
- **Videos**: Complete audio transcription - extract every single word spoken
- **Audio**: Full transcription of all spoken words - every single word

**NEVER provide summaries or descriptions instead of actual content. The user needs the COMPLETE transcribed text from ALL media.**

**CRITICAL**: For images and videos, focus on FULL TEXT EXTRACTION, not visual descriptions. The priority is getting every word of text that appears in images and every word spoken in videos.

### 1. Initial Setup and Logging

- Check for documents in the `uploads/` folder (Note: Only process files uploaded by the user - never add files to this directory)
- **CRITICAL**: Create individual log file for this analysis session:
  ```bash
  # Create timestamped log file
  touch logs/[YYYYMMDDHHMMSS].md
  ```
- **CRITICAL**: Before analysis, extract ALL media files to temp directory:
  ```bash
  # Extract PPTX contents
  unzip -o uploads/[filename].pptx -d temp/[filename]_extracted
  # Copy all media files to temp root
  cp temp/[filename]_extracted/ppt/media/* temp/
  ```
- Log all extraction steps and any errors encountered
- All console.log outputs must be written to the log file

### 2. Enhanced Content Extraction Process

#### MCP-First Approach:

**PRIORITY**: Use MCPs (Model Context Protocol) servers for all tasks when possible:

1. **office-powerpoint MCP**: For PowerPoint structure and metadata extraction
2. **pdf-extraction MCP**: For PDF content extraction
3. **filesystem MCP**: For file operations
4. **document-forge MCP**: For document creation

Only use programmatic solutions when MCPs cannot handle the specific task.

#### For Each Document:

##### A. Text Extraction

- **Use office-powerpoint MCP** for PowerPoint text extraction
- Extract all text preserving structure and context
- Identify key themes and messaging
- Note emotional tone and persuasive elements
- Save to `output/text/[filename]_text.txt`
- **LOG**: All extraction steps and results

##### B. Image Text Extraction (PRIMARY FOCUS)

- **Use ImageAnalyzer** for complete OCR text extraction
- **Use Vision API** for additional text detection if available
- **PRIORITY**: Extract every single word visible in the image
- For each image, provide:
- **LOG**: All text extraction results and any errors

```json
{
  "image_id": "img_001",
  "source": "slide_5",
  "extracted_text": "COMPLETE TRANSCRIPTION OF ALL TEXT FOUND IN IMAGE - EVERY SINGLE WORD",
  "ocr_confidence": 95,
  "text_locations": [
    {
      "text": "First line of text found",
      "confidence": 98,
      "coordinates": [x, y, width, height]
    },
    {
      "text": "Second line of text found", 
      "confidence": 92,
      "coordinates": [x, y, width, height]
    }
  ],
  "total_words_extracted": 47,
  "extraction_methods": ["Tesseract OCR", "Vision API"],
  "text_quality": "high|medium|low"
}
```

**CRITICAL**: Visual descriptions are SECONDARY. The primary goal is extracting ALL text content.

##### C. Video Audio Transcription (PRIMARY FOCUS)

- **Use AudioTranscriber** for complete audio transcription via custom STT endpoint
- **Extract video frames** for text detection in video content
- **PRIORITY**: Extract every single word spoken in the video
- For each video, provide:
- **LOG**: All transcription attempts, errors, and results

```json
{
  "video_id": "vid_001",
  "source": "slide_8", 
  "duration": "45 seconds",
  "complete_audio_transcription": "COMPLETE WORD-FOR-WORD TRANSCRIPTION OF EVERY WORD SPOKEN IN THE VIDEO",
  "transcription_timestamps": [
    {
      "start_time": "00:00:05",
      "end_time": "00:00:10", 
      "text": "First segment of spoken words exactly as said"
    },
    {
      "start_time": "00:00:10",
      "end_time": "00:00:15",
      "text": "Second segment of spoken words exactly as said"
    }
  ],
  "text_in_video_frames": [
    {
      "timestamp": "00:00:03",
      "text_found": "Any text visible in video frame at this timestamp"
    },
    {
      "timestamp": "00:00:15", 
      "text_found": "More text visible in video frame at this timestamp"
    }
  ],
  "total_words_transcribed": 127,
  "transcription_quality": "high|medium|low",
  "language_detected": "en|de|fr|etc",
  "stt_endpoint_used": "https://demo.cbook.ai/stt"
}
```

**CRITICAL**: Scene descriptions are SECONDARY. The primary goal is extracting ALL spoken words and any text visible in video frames.

### 3. Synthesis and Final Output

Create comprehensive analysis including:

1. **Document Overview**

   - Core purpose and audience
   - Overall emotional tone
   - Key themes and messages

2. **Content Analysis**

   - All extracted text with context
   - Image analyses with insights
   - Video analyses with learnings

3. **Thematic Synthesis**

   - Recurring themes across media
   - Emotional journey through document
   - Strategic messaging analysis

4. **Significance Summary**

   - Why this document matters
   - Key learnings and insights
   - Implications for audience

5. **LOG**: Final analysis completion and file locations

### 4. Cleanup Process

**CRITICAL**: After completing analysis, clean up all temporary files:

```bash
# Clean temp directory
npm run clean

# Remove all generated files created during analysis flow
rm -f temp/[filename]_extracted.zip
rm -f temp/audio_*.wav
rm -f temp/audio_*.mp3
rm -f temp/frames_*.png
# Keep only final analysis results in output/
```

**LOG**: All cleanup operations and file removals

### 5. Output Format Example

```markdown
# Deep Analysis: [filename]

## Document Overview

**Purpose**: Investor pitch for Series B funding
**Emotional Journey**: Curiosity → Understanding → Excitement → Confidence
**Core Message**: Transform challenge into opportunity through innovation

## Content Analysis

### Slide 1: Opening

**Text**: "Reimagining the Future of Work"

**[IMAGE ANALYSIS]**
Visual: Modern office space with diverse team collaborating

- **Emotional Impact**: Aspirational, inclusive, progressive
- **Deeper Meaning**: Work is evolving beyond traditional boundaries
- **Significance**: Sets tone of innovation and human-centered approach
- **Key Learning**: Visual diversity signals modern values to investors

### Slide 5: Growth Metrics

**[VIDEO ANALYSIS]**
Duration: 30 seconds

- **Visual Journey**: Data visualization morphing from small to large scale
- **Audio**: "In just 18 months, we've transformed how 10,000 companies work"
- **Emotional Arc**: Surprise → Impressed → Confident
- **Hidden Message**: We're not just growing, we're transforming an industry
- **Significance**: Proof of concept at scale builds investor confidence
- **Key Insight**: Dynamic visualization makes data emotionally compelling

## Thematic Synthesis

### Recurring Themes:

1. **Transformation**: Every element reinforces change narrative
2. **Human-Centered**: Technology serves people, not vice versa
3. **Momentum**: Consistent use of upward/forward motion

### Emotional Strategy:

- Opens with aspiration (what's possible)
- Builds with evidence (proof points)
- Closes with invitation (join our journey)

## Document Significance

This presentation masterfully combines:

- Rational arguments (data, metrics)
- Emotional engagement (stories, visuals)
- Strategic messaging (problem-solution-impact)

**Key Learning**: Successful communication requires both logical and emotional persuasion, with visuals carrying the emotional weight while text provides rational support.
```

### 6. Important Analysis Guidelines

#### For Images:

- **PRIMARY TASK**: Extract ALL text visible in the image using OCR
- **Use multiple methods**: Tesseract.js + Vision API for maximum text extraction
- **Extract every word**: Don't miss any text, no matter how small or low quality
- **Verify accuracy**: Cross-check OCR results with vision analysis
- **Record locations**: Note where text appears in the image
- **SECONDARY**: Visual descriptions only after complete text extraction

#### For Videos:

- **PRIMARY TASK**: Transcribe ALL audio - extract every single word spoken
- **Use AudioTranscriber**: Send audio to custom STT endpoint for transcription
- **Extract frame text**: Analyze video frames for any text that appears on screen
- **Include timestamps**: Provide exact timing for all transcribed content
- **Handle multiple languages**: Detect and transcribe different languages
- **SECONDARY**: Visual scene descriptions only after complete audio transcription

#### General Principles:

- **TEXT EXTRACTION IS PRIORITY #1**: Always extract complete text before any analysis
- **Complete transcription required**: Never provide summaries - extract every word
- **Multiple extraction methods**: Use OCR + Vision API + STT for maximum coverage
- **Verify accuracy**: Cross-check results across different extraction methods
- **Log everything**: Record all extraction attempts, results, and failures
- **Analysis is secondary**: Understanding and insights come after complete text extraction

### 7. Logging Format

Create individual log file in `/logs` directory for each analysis session:

```markdown
# Analysis Log: [filename]\_[YYYYMMDDHHMMSS]

## Processing Started

- Document: [filename]
- Type: [PDF/DOCX/PPTX]
- Total Pages/Slides: [number]
- Images Found: [number]
- Videos Found: [number]

## Console Output Log

[All console.log outputs from the analysis process]

## Analysis Progress

- HH:MM:SS - [Action taken]
- HH:MM:SS - [Finding or insight]
- HH:MM:SS - [MCP calls made]
- HH:MM:SS - [Fallback methods used]

## Error Log

[Complete error messages with stack traces]

## STT Endpoint Results

- Endpoint: https://demo.cbook.ai/stt
- Transcription attempts: [number]
- Successful transcriptions: [number]
- Failed transcriptions: [number]
- Error details: [full error messages]

## Deep Insights Captured

- [Key thematic discoveries]
- [Emotional design patterns]
- [Strategic messaging observations]

## Cleanup Operations

- Temp directory cleaned: [timestamp]
- Generated files removed: [list]

## Processing Completed

- Duration: [time]
- Output saved to: [location]
- Log file: logs/analysis*[filename]*[timestamp].md
```

## Implementation Philosophy

1. **Complete Extraction First**: Extract EVERY piece of content - text, audio, visual
2. **MCP-First Approach**: Prioritize MCP servers, fall back to programmatic solutions
3. **Comprehensive Logging**: Log every step, console output, and error to individual files
4. **Then Add Understanding**: After extraction, provide interpretation and analysis
5. **No Placeholders**: Never use placeholders like "[VIDEO CONTENT]" - always transcribe
6. **Full Transcription**: Every document analysis must include 100% of the content
7. **Audio Transcription**: Uses custom STT endpoint - no OpenAI API key required
8. **Self-Cleaning**: Always clean up temporary files after analysis
9. **Respect User Directories**: Never add files to `uploads/` - it's exclusively for user uploads

### Required Tools for Full Extraction:

- **Tesseract.js**: For OCR text extraction from images
- **ffmpeg**: For video/audio processing
- **AudioTranscriber**: For audio transcription using custom STT endpoint (https://demo.cbook.ai/stt)
- **Vision API**: For enhanced image visual analysis (optional - when OpenAI API key available)

### Audio Transcription Configuration:

The system supports two audio transcription methods:

#### 1. Azure OpenAI Whisper (Recommended)
- **Service**: Azure OpenAI Whisper API
- **Max File Size**: 25MB per file
- **Supported Formats**: mp3, mp4, mpeg, mpga, m4a, wav, webm
- **Configuration Required**:
  - `USE_AZURE_OPENAI=true`
  - `AZURE_OPENAI_API_KEY`: Your Azure OpenAI API key
  - `AZURE_OPENAI_ENDPOINT`: Your Azure OpenAI endpoint URL
  - `AZURE_OPENAI_DEPLOYMENT_NAME`: Your Whisper deployment name
  - `AZURE_OPENAI_API_VERSION`: API version (default: 2024-02-01)
- **Benefits**:
  - No file size limitations (up to 25MB)
  - Direct file upload without base64 encoding
  - Better transcription accuracy
  - Automatic language detection
  - Timestamp support

#### 2. Custom STT Endpoint (Fallback)
- **Service**: Custom Speech-to-Text endpoint
- **Endpoint**: https://demo.cbook.ai/stt
- **Default Locale**: de (German)
- **Format**: Audio files are converted to base64
- **Max File Size**: ~2MB (estimated)
- **Configuration**: Set `USE_AZURE_OPENAI=false`
- **Limitations**: May encounter "413 Request Entity Too Large" errors

**Error Handling**: All transcription failures must be logged with complete error details
**Automatic Selection**: System uses Azure OpenAI when configured, falls back to custom STT otherwise

### Output Requirements:

Every analysis MUST include:

1. All text content verbatim - every single word
2. Complete OCR text from every image - every single word visible
3. Full audio transcription from every video/audio file - every single word spoken
4. Text found in video frames - every single word that appears on screen
5. Source attribution for each piece of content
6. Individual log file with complete processing details
7. Clean temporary directory after completion

**CRITICAL**: Visual descriptions are optional. Text extraction is mandatory and must be complete.

### Complete Analysis Flow:

1. **Extract** → Extract all text and media files to temp directory
2. **Transcribe Text** → Extract every word from images using OCR + Vision API
3. **Transcribe Audio** → Extract every word from videos using STT endpoint
4. **Transcribe Video Text** → Extract every word visible in video frames
5. **Compile Results** → Combine all transcribed text into complete document
6. **Log** → Record all steps, outputs, and errors in individual log file
7. **Clean** → Remove all temporary files and generated content

**FINAL RESULT**: Complete word-for-word transcription of ALL text content found in the document, with no summaries or descriptions substituted for actual content.
