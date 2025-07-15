import { convertPptxToSlideImages } from './src/utils/libreoffice-converter.js';
import path from 'path';
import fs from 'fs/promises';

async function testConversion() {
  const pptxPath = 'uploads/Feinkonzeptionsworkshop.pptx';
  const outputDir = `output/test_libreoffice_${Date.now()}`;
  
  console.log('Testing LibreOffice slide conversion...\n');
  
  try {
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });
    
    // Try to convert
    const result = await convertPptxToSlideImages(pptxPath, outputDir);
    
    if (result) {
      console.log('\n✅ Conversion successful!');
      console.log(`   Slides: ${result.slideCount}`);
      console.log(`   Output: ${result.outputDir}`);
      console.log(`   Method: ${result.method}`);
      
      // List created files
      const slidesDir = path.join(outputDir, 'slides');
      const files = await fs.readdir(slidesDir);
      console.log('\n📸 Generated slide images:');
      files.forEach(f => console.log(`   - ${f}`));
      
    } else {
      console.log('\n⚠️  LibreOffice not available.');
      console.log('Install with: brew install libreoffice');
      console.log('\nFalling back to text extraction method.');
    }
    
  } catch (error) {
    console.error('\n❌ Error during conversion:', error.message);
  }
}

// Run test
testConversion().catch(console.error);