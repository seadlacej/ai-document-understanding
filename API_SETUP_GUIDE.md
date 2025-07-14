# API Setup Guide for AI Document Understanding

## Prerequisites

### 1. Create .env File
Copy the example file:
```bash
cp .env.example .env
```

### 2. Configure STT (Speech-to-Text)
The system uses a custom STT endpoint by default:
```
STT_ENDPOINT=https://demo.cbook.ai/stt
STT_LOCALE=de
```

This is already configured in the .env.example file.

### 3. Optional: OpenAI API Key for Enhanced Image Analysis
If you want enhanced image analysis with Vision API:
1. Go to https://platform.openai.com/api-keys
2. Sign up or log in
3. Create a new API key
4. Copy the key (it starts with `sk-`)
5. Add to `.env`:
```
OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 4. Install ffmpeg
Run the setup script:
```bash
./setup-ffmpeg.sh
```

Or install manually:
- **macOS**: `brew install ffmpeg`
- **Ubuntu/Debian**: `sudo apt install ffmpeg`
- **Windows**: Download from https://www.gyan.dev/ffmpeg/builds/

## How the APIs Work

### Custom STT API (Audio Transcription)
- **Purpose**: Transcribes audio from videos
- **Endpoint**: https://demo.cbook.ai/stt
- **Format**: Accepts audio files as base64
- **Language**: Configurable via `locale` parameter (default: 'de')

### Vision API (Image Analysis)
- **Purpose**: Analyzes images and extracts text
- **Cost**: ~$0.01-0.03 per image
- **Features**: 
  - OCR (text extraction)
  - Object detection
  - Scene understanding
  - Detailed descriptions

## Usage

### Basic Analysis
```bash
node src/comprehensive-analyzer.js uploads/your-file.pptx
```

### With API Keys Set
The system will automatically:
1. Extract audio from videos using ffmpeg
2. Send audio to Whisper API for transcription
3. Send images to Vision API for analysis
4. Combine all results into complete transcription

### Output Files
- `output/final/[filename]_COMPLETE_TRANSCRIPTION.md` - Human-readable transcription
- `output/final/[filename]_COMPLETE_ANALYSIS.json` - Structured data

## Cost Estimation

### With Custom STT (Default):
- Audio transcription: **FREE** (using custom endpoint)
- Image OCR: **FREE** (using Tesseract.js)
- **Total: $0.00**

### With OpenAI Vision API (Optional):
- Audio transcription: **FREE** (using custom endpoint)
- Enhanced image analysis: ~$0.02 per image
- For 10 images: ~$0.20 total

## Troubleshooting

### "STT endpoint error"
- Check your internet connection
- Verify the STT endpoint is accessible
- Check if the audio file format is supported

### "OPENAI_API_KEY is required" (for Vision API)
- This is optional - only needed for enhanced image analysis
- Basic OCR will still work without it
- Add the key to `.env` if you want Vision API features

### "ffmpeg not found"
- Run `./setup-ffmpeg.sh`
- Verify installation: `ffmpeg -version`

### "File size exceeds limit"
- Videos over 25MB need to be split
- Consider compressing audio before sending

### API Errors
- Check API key validity
- Verify you have credits in your OpenAI account
- Check rate limits (3 requests per minute for free tier)

## Environment Variables

All available settings in `.env`:
```env
# Required
OPENAI_API_KEY=sk-...

# Optional
WHISPER_MODEL=whisper-1              # Audio model
VISION_MODEL=gpt-4-vision-preview    # Vision model
MAX_TOKENS=4000                      # Max response length
TEMPERATURE=0.1                      # Creativity (0=factual, 1=creative)
```

## Security Notes

⚠️ **IMPORTANT**:
- Never commit `.env` file to git
- Keep your API key secret
- Monitor usage at https://platform.openai.com/usage
- Set spending limits in OpenAI dashboard

## Next Steps

1. Add your API key to `.env`
2. Install ffmpeg
3. Run the analyzer on your documents
4. Check the complete transcriptions in `output/final/`

---

For more help, see:
- OpenAI API Docs: https://platform.openai.com/docs
- Whisper Guide: https://platform.openai.com/docs/guides/speech-to-text
- Vision Guide: https://platform.openai.com/docs/guides/vision