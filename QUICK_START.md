# 🚀 Quick Start Guide

## Setup Steps

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Set Up Environment
```bash
# Copy the example environment file
cp .env.example .env
```

The default configuration uses your custom STT endpoint:
```
STT_ENDPOINT=https://demo.cbook.ai/stt
STT_LOCALE=de
```

**Optional**: For enhanced image analysis, add an OpenAI API key:
```
OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 3. Download Tesseract Language Data
```bash
# Download English language data for OCR
./setup-tesseract.sh
```

### 4. Install ffmpeg (for video processing)
```bash
# Run the setup script
./setup-ffmpeg.sh

# Or install manually:
# macOS: brew install ffmpeg
# Ubuntu: sudo apt install ffmpeg
```

### 5. Test Your Setup
```bash
# Run the API integration test
node test-api-integration.js
```

## Usage

### Analyze a PowerPoint Presentation
```bash
# Place your PPTX file in the uploads folder
# Then run:
node src/comprehensive-analyzer.js uploads/your-presentation.pptx
```

### What You'll Get

The system will extract and transcribe:
- ✅ All text content from slides
- ✅ Full audio transcription from videos (using your STT endpoint)
- ✅ OCR text extraction from images (using Tesseract.js)
- ✅ Visual descriptions of images (with OpenAI Vision API if configured)
- ✅ Frame-by-frame analysis of videos
- ✅ Hidden slides and speaker notes
- ✅ Emotional and thematic analysis

### Output Files

Check the `output/final/` folder for:
- `[filename]_FULL_TRANSCRIPTION.md` - Complete human-readable transcription
- `[filename]_COMPLETE_ANALYSIS.json` - Structured data with all extracted content

## Cost Estimates

### Default Configuration (Custom STT):
- Audio transcription: **FREE**
- Image OCR: **FREE**
- **Total: $0.00**

### With OpenAI Vision API:
- Audio transcription: **FREE** (using custom STT)
- Enhanced image analysis: ~$0.02 per image
- **Total for 10 images: ~$0.20**

## Troubleshooting

### "STT endpoint error"
- Check your internet connection
- Verify the STT endpoint is accessible
- Check the audio file format

### Image analysis limited?
- For enhanced image analysis, add OPENAI_API_KEY to `.env`
- Basic OCR will work without it

### "ffmpeg not found"
- Run `./setup-ffmpeg.sh` to install ffmpeg
- Verify with: `ffmpeg -version`

### Need Help?
- Check `API_SETUP_GUIDE.md` for detailed instructions
- Review your API usage at: https://platform.openai.com/usage