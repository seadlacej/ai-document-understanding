import { GeminiVideoAnalyzer } from "../src/utils/gemini-video-analyzer.js";
import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

console.log("🎥 Gemini Video Analysis Test Tool");
console.log("=".repeat(50));

async function testGeminiVideo(): Promise<void> {
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
    console.error("❌ No video filename provided");
    console.log("\nUsage: node test-gemini-video.js -- [filename]");
    console.log("Example: node test-gemini-video.js -- sample_video.mp4");
    console.log("\nThe video file must be in the temp/ directory");
    return;
  }

  const videoFilename = args[dashDashIndex + 1];
  const testVideoPath = path.join("./temp", videoFilename);

  // Check if video exists in temp directory
  try {
    await fs.access(testVideoPath);
    console.log(`📹 Using video: ${videoFilename}`);
  } catch (err) {
    console.error(`❌ Video '${videoFilename}' not found in temp directory`);
    return;
  }

  // Test Gemini video analysis
  console.log("\n🧪 Testing Gemini 2.5 Flash Video Analysis...\n");

  const analyzer = new GeminiVideoAnalyzer();

  try {
    console.log("🔄 Analyzing video with Gemini...");
    console.log(
      "This may take a moment as the video is uploaded and processed...\n"
    );

    const result = await analyzer.analyzeVideo(testVideoPath, {
      source: "test",
    });

    console.log("\n📊 Analysis Results:");
    console.log("=".repeat(50));

    if (result.error) {
      console.error("❌ Error:", result.error);
      return;
    }

    // Video info
    console.log("\n📹 Video Information:");
    console.log(`- Duration: ${result.analysis.duration}s`);
    console.log(`- Language: ${result.analysis.language || "unknown"}`);

    // Audio transcription
    console.log("\n🎤 Audio Transcription:");
    console.log("-".repeat(50));
    if (result.analysis.audioTranscription) {
      console.log(result.analysis.audioTranscription);
    } else {
      console.log("[No audio/speech detected]");
    }
    console.log("-".repeat(50));

    // Scenes
    if (result.analysis.scenes && result.analysis.scenes.length > 0) {
      console.log("\n🎬 Scene Breakdown:");
      result.analysis.scenes.forEach((scene, idx) => {
        console.log(
          `\n  Scene ${idx + 1} (${scene.startTime} - ${scene.endTime}):`
        );
        console.log(`  - ${scene.description}`);
        if (scene.spokenText) {
          console.log(`  - Spoken: "${scene.spokenText}"`);
        }
      });
    }

    // Summary
    if (result.analysis.summary) {
      console.log("\n📋 Summary:");
      console.log(result.analysis.summary);
    }

    console.log("\n✅ Gemini Video analysis test completed successfully!");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("\n❌ Gemini Video test failed:", errorMessage);

    if (errorMessage.includes("API key")) {
      console.log("⚠️ Invalid API key - please check your Gemini API key");
    } else if (errorMessage.includes("quota")) {
      console.log("⚠️ API quota exceeded - please check your usage limits");
    } else if (errorMessage.includes("model")) {
      console.log(
        "⚠️ Model not available - ensure you have access to gemini-2.5-flash"
      );
    } else if (errorMessage.includes("size")) {
      console.log("⚠️ Video file too large - try a smaller video");
    }
  }
}

// Run the test
testGeminiVideo().catch(console.error);