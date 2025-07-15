# LibreOffice Setup Guide

## Overview

LibreOffice enables the conversion of PowerPoint slides to images, preserving complex layouts, diagrams, and visual relationships that are critical for understanding presentation content.

## Installation

### macOS (Local Development)

#### Using Homebrew (Recommended)
```bash
# Install LibreOffice
brew install libreoffice

# Verify installation
npm run check:libreoffice
```

#### Manual Installation
1. Download from: https://www.libreoffice.org/download/download/
2. Install the .dmg package
3. LibreOffice will be installed at: `/Applications/LibreOffice.app`

### Docker/Coolify (Production)

LibreOffice is automatically included in the Dockerfile. No manual setup needed!

```bash
# Build the Docker image
npm run docker:build

# Run with volume mounts
npm run docker:run
```

## How It Works

### With LibreOffice Installed:
1. Each PowerPoint slide is converted to a high-quality PNG image
2. Images are saved as `slides/slide_001.png`, `slides/slide_002.png`, etc.
3. Gemini analyzes these images to understand complete slide content and layout
4. Perfect for slides with complex diagrams, arrows, and visual relationships

### Without LibreOffice:
1. System falls back to basic text extraction from PPTX
2. May miss visual relationships and layout context
3. Recommended: Install LibreOffice for complete analysis

## Verification

Check if LibreOffice is properly installed:

```bash
npm run check:libreoffice
```

Expected output when installed:
```
✅ LibreOffice is installed and ready to use!
   Path: /usr/local/bin/soffice

📸 Slide image generation is available.
```

## Troubleshooting

### macOS Issues

1. **"soffice: command not found"**
   - LibreOffice might be installed but not in PATH
   - The converter checks common locations automatically
   - Try: `brew link libreoffice`

2. **Homebrew installation fails**
   - Update Homebrew: `brew update`
   - Try: `brew install --cask libreoffice`

3. **Permission issues**
   - Ensure LibreOffice has necessary permissions in System Preferences

### Docker Issues

1. **Large image size**
   - The Docker image is ~1GB due to LibreOffice
   - This is a one-time download cost
   - Use multi-stage builds if size is critical

2. **Font rendering issues**
   - The Dockerfile includes common fonts
   - Add specific fonts if needed:
     ```dockerfile
     RUN apk add --no-cache font-your-specific-font
     ```

## Performance Notes

- First conversion may be slower (LibreOffice startup)
- Subsequent conversions are faster
- Each slide takes ~1-2 seconds to convert
- Memory usage: ~200-500MB during conversion

## Alternative: Cloud Services

If LibreOffice installation is not possible:
1. Google Slides API (free tier available)
2. Aspose Cloud API (paid)
3. CloudConvert API (limited free tier)

Installing LibreOffice is highly recommended for accurate slide analysis!