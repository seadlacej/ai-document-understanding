#!/bin/bash

echo "🎬 FFmpeg Setup Script for AI Document Understanding"
echo "=================================================="
echo ""

# Detect OS
OS="Unknown"
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macOS"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="Linux"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    OS="Windows"
fi

echo "Detected OS: $OS"
echo ""

# Check if ffmpeg is already installed
if command -v ffmpeg &> /dev/null; then
    echo "✅ ffmpeg is already installed!"
    ffmpeg -version | head -n 1
    echo ""
    echo "✅ ffprobe is available!"
    ffprobe -version | head -n 1
    exit 0
fi

echo "❌ ffmpeg not found. Installation required for video processing."
echo ""

# Installation instructions based on OS
case $OS in
    "macOS")
        echo "📝 Installation options for macOS:"
        echo ""
        echo "Option 1: Using Homebrew (recommended)"
        echo "  1. Install Homebrew if not installed: https://brew.sh"
        echo "  2. Run: brew install ffmpeg"
        echo ""
        echo "Option 2: Download from official website"
        echo "  1. Visit: https://ffmpeg.org/download.html"
        echo "  2. Download macOS build"
        echo "  3. Extract and add to PATH"
        echo ""
        
        # Check if brew is installed
        if command -v brew &> /dev/null; then
            echo "🍺 Homebrew detected! Would you like to install ffmpeg now? (y/n)"
            read -r response
            if [[ "$response" == "y" || "$response" == "Y" ]]; then
                echo "Installing ffmpeg..."
                brew install ffmpeg
            fi
        fi
        ;;
        
    "Linux")
        echo "📝 Installation commands for Linux:"
        echo ""
        echo "Ubuntu/Debian:"
        echo "  sudo apt update"
        echo "  sudo apt install ffmpeg"
        echo ""
        echo "Fedora:"
        echo "  sudo dnf install ffmpeg"
        echo ""
        echo "Arch:"
        echo "  sudo pacman -S ffmpeg"
        echo ""
        ;;
        
    "Windows")
        echo "📝 Installation options for Windows:"
        echo ""
        echo "Option 1: Using Chocolatey"
        echo "  1. Install Chocolatey: https://chocolatey.org/install"
        echo "  2. Run: choco install ffmpeg"
        echo ""
        echo "Option 2: Manual installation"
        echo "  1. Visit: https://www.gyan.dev/ffmpeg/builds/"
        echo "  2. Download 'release essentials' build"
        echo "  3. Extract to C:\\ffmpeg"
        echo "  4. Add C:\\ffmpeg\\bin to system PATH"
        echo ""
        ;;
        
    *)
        echo "📝 Manual installation:"
        echo "  1. Visit: https://ffmpeg.org/download.html"
        echo "  2. Download appropriate build for your system"
        echo "  3. Extract and add to PATH"
        echo ""
        ;;
esac

echo "After installation, run this script again to verify ffmpeg is installed correctly."
echo ""
echo "📌 Note: ffmpeg is required for:"
echo "  - Extracting audio from videos"
echo "  - Getting video duration and metadata"
echo "  - Extracting video frames for analysis"