# AI Document Understanding

A comprehensive document processing system that extracts and deeply analyzes content from PDF, DOCX, and PPTX files, including embedded images and videos, with emotional and thematic interpretation.

## Features

- **Multi-format Support**: Process PDF, DOCX, and PPTX files
- **Deep Image Analysis**:
  - Visual description and OCR text extraction
  - Emotional impact assessment
  - Thematic interpretation and symbolism
  - Contextual significance within the document
- **Comprehensive Video Analysis**:
  - Visual narrative understanding
  - Audio transcription
  - Combined audio-visual synthesis
  - Emotional journey mapping
- **Intelligent Content Extraction**:
  - Text with preserved structure
  - Hidden content in presentations
  - Embedded media extraction
- **Source Attribution**: Track exact location of all content
- **Detailed Logging**: Timestamped logs for all operations

## Quick Start

1. **Install dependencies**:

   ```bash
   pnpm install
   ```

2. **Place documents** in the `uploads/` folder

3. **Configure your AI tool** (Claude, VS Code, etc.) to use the `.mcp.json` file for enhanced processing capabilities

4. **Example prompt for PPTX analysis**:

   ```
   "Please analyze the PowerPoint file uploads/Feinkonzeptionsworkshop.pptx following the workflow in CLAUDE.md."
   ```

5. **Process documents** by asking your AI assistant to analyze files in the uploads folder

## Project Structure

```
ai-document-understanding/
├── uploads/              # Place your documents here
├── output/
│   ├── text/            # Extracted text content
│   ├── images/          # Image analysis results
│   ├── videos/          # Video analysis results
│   ├── analysis/        # Thematic insights
│   └── final/           # Complete document analysis
├── temp/                # Temporary processing files
├── logs/                # Processing logs (YYYYMMDDHHMMSS.md)
├── .mcp.json           # MCP server configuration
├── CLAUDE.md           # AI assistant instructions
└── package.json        # Project dependencies
```

## How It Works

### 1. Document Upload

Place your PDF, DOCX, or PPTX files in the `uploads/` folder.

### 2. AI Processing

The system uses multiple approaches to understand your documents:

- **Text Extraction**: Preserves structure and context
- **Image Analysis**:
  - Describes what's shown visually
  - Extracts text via OCR
  - Interprets emotional impact and deeper meaning
  - Identifies strategic significance
- **Video Analysis**:
  - Analyzes visual content frame by frame
  - Transcribes audio
  - Creates unified understanding of audio-visual elements

### 3. Deep Understanding

Beyond simple extraction, the system provides:

- **Emotional Analysis**: What feelings do images/videos evoke?
- **Thematic Interpretation**: What deeper messages are conveyed?
- **Strategic Insights**: Why were these choices made?
- **Learning Extraction**: What can we learn from the communication approach?

### 4. Output Generation

Results are saved in structured formats with:

- Source attribution (document, page, element)
- Visual descriptions
- Extracted text
- Emotional and thematic analysis
- Key learnings and insights

## Example Analysis Output

```markdown
**[IMAGE ANALYSIS]**
Visual: Modern office space with diverse team collaborating

- **Emotional Impact**: Aspirational, inclusive, progressive
- **Deeper Meaning**: Work is evolving beyond traditional boundaries
- **Significance**: Sets tone of innovation and human-centered approach
- **Key Learning**: Visual diversity signals modern values to investors

**[VIDEO ANALYSIS]**
Duration: 30 seconds

- **Visual Journey**: Data visualization morphing from small to large scale
- **Audio**: "In just 18 months, we've transformed how 10,000 companies work"
- **Emotional Arc**: Surprise → Impressed → Confident
- **Hidden Message**: We're not just growing, we're transforming an industry
- **Key Insight**: Dynamic visualization makes data emotionally compelling
```

## MCP Servers

The project uses Model Context Protocol (MCP) servers for enhanced processing:

- **pdf-extraction**: Advanced PDF processing with OCR
- **document-forge**: DOCX/PPTX content extraction
- **filesystem**: Secure file access
- **image-analysis**: AI-powered vision capabilities

## Logging

All operations are logged with timestamps in the `logs/` directory:

- Filename format: `YYYYMMDDHHMMSS.md`
- Tracks processing progress
- Documents insights and findings
- Records any errors or issues

## Use Cases

- **Presentation Analysis**: Understand the complete narrative of pitch decks
- **Document Intelligence**: Extract insights from complex reports
- **Content Auditing**: Analyze emotional and strategic messaging
- **Accessibility**: Convert visual content to detailed text descriptions
- **Research**: Deep analysis of academic or business documents

## Requirements

- Node.js 18+
- pnpm package manager
- AI assistant with MCP support (Claude, VS Code Copilot, etc.)

## Contributing

This project is designed to work with AI assistants. Contributions should focus on:

- Improving analysis frameworks
- Adding new document format support
- Enhancing extraction capabilities
- Refining emotional and thematic interpretation guidelines

## License

MIT License - see package.json for details
