import { GeminiAnalyzer } from "./src/utils/gemini-image-analyzer.js";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

console.log("🔷 Gemini Vision Test Tool");
console.log("=".repeat(50));

async function testGeminiVision() {
  // Check API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ Gemini API key not configured!");
    console.log("Please set GEMINI_API_KEY in your .env file");
    console.log("\nTo get a Gemini API key:");
    console.log("1. Go to https://makersuite.google.com/app/apikey");
    console.log("2. Create a new API key");
    console.log("3. Add it to your .env file as GEMINI_API_KEY=your-key-here");
    return;
  }

  console.log("✅ Gemini API key found");

  // Parse command line arguments
  const args = process.argv.slice(2);
  const dashDashIndex = args.indexOf("--");

  if (dashDashIndex === -1 || !args[dashDashIndex + 1]) {
    console.error("❌ No image filename provided");
    console.log("\nUsage: node test-gemini-vision.js -- [filename]");
    console.log("Example: node test-gemini-vision.js -- image16.png");
    console.log("\nThe image file must be in the temp/ directory");
    return;
  }

  const imageFilename = args[dashDashIndex + 1];
  const testImagePath = path.join("./temp", imageFilename);

  // Check if image exists in temp directory
  try {
    await fs.access(testImagePath);
    console.log(`📷 Using image: ${imageFilename}`);
  } catch (err) {
    console.error(`❌ Image '${imageFilename}' not found in temp directory`);
    return;
  }

  // Test Gemini analysis
  console.log("\n🧪 Testing Gemini 2.5 Flash Vision Analysis...\n");

  const analyzer = new GeminiAnalyzer();

  try {
    console.log("🔄 Analyzing image with Gemini...");
    const result = await analyzer.analyzeImage(testImagePath, {
      source: "test",
    });

    console.log("\n📊 Analysis Results:");
    console.log("=".repeat(50));

    if (result.error) {
      console.error("❌ Error:", result.error);
      return;
    }

    // Extracted Text
    console.log("\n📝 Extracted Text:");
    console.log("-".repeat(50));
    if (result.analysis.extractedText) {
      console.log(result.analysis.extractedText);
    } else {
      console.log("[No text extracted]");
    }
    console.log("-".repeat(50));

    // Description
    console.log("\n🖼️ Image Description:");
    console.log(result.analysis.description || "[No description]");

    // Analysis Information
    console.log("\n📋 Analysis Details:");
    console.log(`- Language: ${result.analysis.language || "unknown"}`);
    console.log(`- Confidence: ${result.analysis.confidence || "unknown"}`);

    console.log("\n✅ Gemini Vision test completed successfully!");
  } catch (error) {
    console.error("\n❌ Gemini Vision test failed:", error.message);

    if (error.message.includes("API key")) {
      console.log("⚠️ Invalid API key - please check your Gemini API key");
    } else if (error.message.includes("quota")) {
      console.log("⚠️ API quota exceeded - please check your usage limits");
    } else if (error.message.includes("model")) {
      console.log(
        "⚠️ Model not available - ensure you have access to gemini-2.5-flash"
      );
    }
  }
}

// Run the test
testGeminiVision().catch(console.error);
