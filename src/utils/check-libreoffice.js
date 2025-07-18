import { LibreOfficeConverter } from './libreoffice-converter.js';

/**
 * Check if LibreOffice is installed and provide installation instructions
 */
async function checkLibreOffice() {
  console.log('Checking LibreOffice installation...\n');
  
  const converter = new LibreOfficeConverter();
  const isAvailable = await converter.checkAvailability();
  
  if (isAvailable) {
    console.log('✅ LibreOffice is installed and ready to use!');
    console.log(`   Path: ${converter.libreOfficePath}`);
    console.log('\n📄 PDF conversion is available.');
  } else {
    console.log('❌ LibreOffice is not installed.\n');
    console.log('To enable PDF conversion, please install LibreOffice:\n');
    console.log('🍎 For macOS:');
    console.log('   brew install libreoffice\n');
    console.log('🐳 For Docker/Coolify:');
    console.log('   LibreOffice is included in the Dockerfile\n');
    console.log('📝 Without LibreOffice:');
    console.log('   The system will use comprehensive text extraction');
    console.log('   to analyze slide content (no PDF conversion).\n');
  }
}

checkLibreOffice().catch(console.error);