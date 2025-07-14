#!/bin/bash

echo "📚 Tesseract Language Data Setup"
echo "================================"
echo ""

# Check if eng.traineddata already exists
if [ -f "eng.traineddata" ]; then
    echo "✅ eng.traineddata already exists"
    exit 0
fi

echo "📥 Downloading English language data for Tesseract OCR..."
echo ""

# Download from official Tesseract repository
TESSDATA_URL="https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata"

echo "Downloading from: $TESSDATA_URL"
echo ""

# Download the file
if command -v curl &> /dev/null; then
    curl -L -o eng.traineddata "$TESSDATA_URL"
elif command -v wget &> /dev/null; then
    wget -O eng.traineddata "$TESSDATA_URL"
else
    echo "❌ Error: Neither curl nor wget is installed"
    echo "Please install curl or wget and try again"
    exit 1
fi

# Check if download was successful
if [ -f "eng.traineddata" ] && [ -s "eng.traineddata" ]; then
    echo ""
    echo "✅ Successfully downloaded eng.traineddata"
    echo "📏 File size: $(ls -lh eng.traineddata | awk '{print $5}')"
    echo ""
    echo "Tesseract OCR is now ready to process English text!"
else
    echo ""
    echo "❌ Error: Failed to download eng.traineddata"
    echo "Please try downloading manually from:"
    echo "$TESSDATA_URL"
    exit 1
fi