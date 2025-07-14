# Tesseract Language Data Note

The `eng.traineddata` file is required for Tesseract OCR to work but is not included in this repository due to its size.

## Quick Setup
```bash
./setup-tesseract.sh
```

This will download the English language data file (~5MB) from the official Tesseract repository.

## Manual Download
If the script doesn't work, you can manually download the file from:
https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata

Place it in the root directory of this project.

## Why not in Git?
Binary files like `eng.traineddata` should not be stored in Git repositories because:
- They increase repository size
- They can't be effectively versioned
- They're readily available from official sources