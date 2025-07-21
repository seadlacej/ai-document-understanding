# AI Document Understanding

A comprehensive document processing system with web interface that extracts and analyzes content from PowerPoint files, including embedded images and videos using Google Gemini AI.

## 🚀 Quick Start

### Option 1: Hybrid Development (Recommended)

```bash
# Install dependencies
pnpm install

# Copy environment file and add your Gemini API key
cp .env.example .env

# Start PocketBase in Docker and run app locally
pnpm run dev:hybrid
```

Access:
- **Web Application**: http://localhost:5173
- **PocketBase Admin**: http://localhost:8090/_/

Default PocketBase login:
- Email: `admin@pocketbase.com`
- Password: `zuFLRXYqqzhfszPVfYwNeUf` (or check your .env file)

### Option 2: Full Docker

```bash
# Start everything with Docker
pnpm run docker:up
```

See [DOCKER.md](./DOCKER.md) for detailed Docker setup.

## ✨ Features

### Web Application
- **Drag & Drop Upload**: Easy file upload interface for PPTX files
- **Batch Processing**: Upload multiple files at once
- **Real-time Status**: Track processing status for each job
- **Automatic Analysis**: Files processed using CLAUDE.md workflow
- **Download Results**: Zipped analysis results when complete

### Document Analysis
- **PowerPoint Support**: Complete PPTX analysis with media extraction
- **PDF Conversion**: Converts slides to PDF using LibreOffice
- **Deep Image Analysis**:
  - Text extraction from images
  - Visual description and context
  - Language detection
- **Video Analysis**:
  - Audio transcription
  - Visual scene understanding
  - Temporal analysis
- **Structured Output**: Markdown reports with all findings

## 🛠️ Technology Stack

- **Frontend**: SvelteKit with TypeScript
- **UI**: Tailwind CSS + shadcn-svelte
- **Backend**: SvelteKit API routes
- **Database**: PocketBase (embedded)
- **AI**: Google Gemini 2.5 Flash
- **Document Processing**: LibreOffice (for PDF conversion)
- **Containerization**: Docker & Docker Compose

## 📁 Project Structure

```
ai-document-understanding/
├── src/                    # Application source code
│   ├── routes/            # SvelteKit pages and API
│   ├── lib/               # Shared components and utilities
│   └── utils/             # Document processing utilities
├── uploads/               # Upload PPTX files here
├── output/                # Analysis results
├── temp/                  # Temporary processing files
├── logs/                  # Processing logs
├── pb_data/              # PocketBase database
├── CLAUDE.md             # AI workflow instructions
├── DOCKER.md             # Docker setup guide
└── docker-compose.yml    # Service orchestration
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file:

```env
# Required
GEMINI_API_KEY=your-gemini-api-key-here

# PocketBase URLs (for hybrid development)
POCKETBASE_URL=http://localhost:8090

# Optional
NODE_ENV=development
POCKETBASE_ADMIN_EMAIL=admin@pocketbase.com
POCKETBASE_ADMIN_PASSWORD=changeme
```

Get your Gemini API key from: https://makersuite.google.com/app/apikey

### LibreOffice Installation

For PDF conversion support:

**macOS:**
```bash
brew install libreoffice
```

**Docker:** Already included in the container

## 📝 How It Works

1. **Upload**: Drop PPTX files in the web interface
2. **Extract**: System extracts all media from the presentation
3. **Convert**: LibreOffice converts PPTX to PDF for analysis
4. **Analyze**: 
   - Gemini analyzes the PDF for complete text extraction
   - Each image is analyzed for text and visual content
   - Videos are transcribed and scene-analyzed
5. **Report**: Generates comprehensive markdown report
6. **Download**: Zip file with all media and analysis

## 🧪 Testing

Test individual components:

```bash
# Test Gemini image analysis
npx tsx test/test-gemini-vision.ts -- image.png

# Test Gemini video analysis  
npx tsx test/test-gemini-video.ts -- video.mp4

# Test LibreOffice conversion
npx tsx test/test-libreoffice-conversion.ts
```

## 🐳 Docker Commands

| Command | Description |
|---------|-------------|
| `pnpm run docker:up` | Start all services |
| `pnpm run docker:down` | Stop all services |
| `pnpm run docker:logs` | View logs |
| `pnpm run db:start` | Start only PocketBase |
| `pnpm run dev:hybrid` | Hybrid development mode |

## 📄 API Usage

### Upload Files
```bash
POST /api/upload
Content-Type: multipart/form-data
```

### Check Job Status
```bash
GET /api/jobs
```

### Download Results
```bash
GET /api/download/{jobId}
```

## 🤝 Contributing

This project uses AI-assisted development. Key areas:

- Improving Gemini prompts for better analysis
- Adding support for more document formats
- Enhancing the web interface
- Optimizing processing performance

## 📜 License

MIT License - see package.json for details