#!/usr/bin/env node

import dotenv from 'dotenv';
import { VisionAnalyzer } from './src/utils/vision-analyzer.js';
import { AudioTranscriber } from './src/utils/audio-transcriber.js';
import { MediaTranscriber } from './src/utils/media-transcriber.js';
import fs from 'fs/promises';
import path from 'path';

// Load environment variables
dotenv.config();

/**
 * Test API Integration
 * Verifies that the APIs are properly configured and working
 */

async function testAPIIntegration() {
  console.log('🧪 Testing API Integration...\n');

  // Check for STT endpoint
  console.log('🎤 Testing STT (Speech-to-Text) Configuration...');
  const sttEndpoint = process.env.STT_ENDPOINT || 'https://demo.cbook.ai/stt';
  const sttLocale = process.env.STT_LOCALE || 'de';
  console.log(`✅ STT Endpoint: ${sttEndpoint}`);
  console.log(`✅ STT Locale: ${sttLocale}\n`);

  // Test STT endpoint
  console.log('🎙️ Testing Custom STT Endpoint...');
  try {
    const stt = new AudioTranscriber();
    await stt.checkEndpoint();
    console.log('✅ STT endpoint is accessible');
    console.log('   Audio transcription will use your custom STT service\n');
  } catch (error) {
    console.error('❌ STT endpoint check failed:', error.message);
  }

  // Test Vision API (optional)
  console.log('📸 Testing Vision API (Optional for image analysis)...');
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-openai-api-key-here') {
    console.log('ℹ️  OpenAI API key not configured');
    console.log('   Image analysis will use Tesseract OCR only');
    console.log('   To enable enhanced image analysis, add OPENAI_API_KEY to .env\n');
  } else {
    try {
      const vision = new VisionAnalyzer();
      console.log('✅ Vision API initialized successfully');
      console.log(`   Model: ${process.env.VISION_MODEL || 'gpt-4-vision-preview'}\n`);
    } catch (error) {
      console.error('❌ Vision API initialization failed:', error.message);
    }
  }


  // Test Media Transcriber
  console.log('🎬 Testing Media Transcriber...');
  try {
    const media = new MediaTranscriber();
    const deps = await media.checkDependencies();
    
    console.log('✅ Media Transcriber initialized');
    console.log(`   ffmpeg: ${deps.ffmpeg ? '✅ Available' : '❌ Not found'}`);
    console.log(`   ffprobe: ${deps.ffprobe ? '✅ Available' : '❌ Not found'}`);
    
    if (!deps.ffmpeg || !deps.ffprobe) {
      console.log('\n⚠️  To install ffmpeg, run: ./setup-ffmpeg.sh');
    }
  } catch (error) {
    console.error('❌ Media Transcriber initialization failed:', error.message);
  }

  console.log('\n📊 Configuration Summary:');
  console.log(`   STT Endpoint: ${sttEndpoint}`);
  console.log(`   STT Locale: ${sttLocale}`);
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here') {
    console.log(`   Vision API Key: ${process.env.OPENAI_API_KEY.substring(0, 7)}...`);
    console.log(`   Vision Model: ${process.env.VISION_MODEL || 'gpt-4-vision-preview'}`);
  }
  console.log(`   Max Tokens: ${process.env.MAX_TOKENS || '4000'}`);
  console.log(`   Temperature: ${process.env.TEMPERATURE || '0.1'}`);

  console.log('\n✨ API integration test complete!');
  console.log('\nNext steps:');
  console.log('1. Place a document in the uploads folder');
  console.log('2. Run: node src/comprehensive-analyzer.js uploads/your-file.pptx');
  console.log('3. Check output/final/ for complete transcriptions\n');
}

// Run the test
testAPIIntegration().catch(console.error);