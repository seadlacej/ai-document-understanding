# CLAUDE.md

This file provides guidance to Claude Code for deep document analysis and understanding.

## Document Processing Workflow with Deep Analysis

### 1. Initial Setup
- Check for documents in the `uploads/` folder
- Create timestamped log entry in `logs/` directory
- Prepare analysis framework

### 2. Enhanced Content Extraction Process

#### For Each Document:

##### A. Text Extraction
- Extract all text preserving structure and context
- Identify key themes and messaging
- Note emotional tone and persuasive elements
- Save to `output/text/[filename]_text.txt`

##### B. Deep Image Analysis
For each image, provide:

```json
{
  "image_id": "img_001",
  "source": "slide_5",
  "visual_description": "Literal description of what is shown",
  "ocr_text": "Any text found in the image",
  "emotional_analysis": {
    "primary_emotions": ["confidence", "innovation"],
    "emotional_impact": "Creates sense of progress and possibility",
    "viewer_response": "Likely to inspire trust and excitement"
  },
  "thematic_interpretation": {
    "surface_message": "Company growth chart",
    "deeper_meaning": "Demonstrates reliability and future potential",
    "symbolic_elements": "Upward trajectory symbolizes success"
  },
  "contextual_significance": {
    "document_role": "Supports main argument about expansion",
    "strategic_purpose": "Builds credibility for proposed initiative",
    "target_impact": "Convinces stakeholders of viability"
  },
  "key_learnings": [
    "Visual data builds trust more than text alone",
    "Growth narrative essential for buy-in",
    "Design choices reflect brand confidence"
  ]
}
```

##### C. Deep Video Analysis
For each video, provide:

```json
{
  "video_id": "vid_001",
  "source": "slide_8",
  "duration": "45 seconds",
  "visual_narrative": {
    "scene_progression": "Opens with problem, shows solution, ends with success",
    "key_moments": ["0:05 - Problem revealed", "0:20 - Solution demonstrated"],
    "visual_techniques": "Fast cuts, bright colors, upbeat pacing"
  },
  "audio_transcription": "Full text of spoken content...",
  "emotional_journey": {
    "emotional_arc": "Concern → Understanding → Excitement → Satisfaction",
    "music_mood": "Builds from subtle to energetic",
    "overall_tone": "Optimistic and empowering"
  },
  "message_analysis": {
    "explicit_message": "Our product solves X problem",
    "implicit_messages": [
      "We understand your challenges",
      "Innovation is accessible",
      "Success is achievable"
    ],
    "persuasive_elements": "Social proof, demonstration, testimonial"
  },
  "significance_assessment": {
    "strategic_role": "Emotional hook for audience engagement",
    "memorable_elements": "Visual metaphor of transformation",
    "call_to_action": "Implicit invitation to join success story"
  },
  "integrated_insights": {
    "audio_visual_alignment": "Words reinforce visual narrative perfectly",
    "production_quality_message": "High quality suggests premium offering",
    "key_takeaways": [
      "Problem-solution narrative highly effective",
      "Emotional engagement drives decision-making",
      "Visual storytelling more powerful than data alone"
    ]
  }
}
```

### 3. Synthesis and Final Output

Create comprehensive analysis including:

1. **Document Overview**
   - Core purpose and audience
   - Overall emotional tone
   - Key themes and messages

2. **Content Analysis**
   - All extracted text with context
   - Image analyses with insights
   - Video analyses with learnings

3. **Thematic Synthesis**
   - Recurring themes across media
   - Emotional journey through document
   - Strategic messaging analysis

4. **Significance Summary**
   - Why this document matters
   - Key learnings and insights
   - Implications for audience

### 4. Output Format Example

```markdown
# Deep Analysis: [filename]

## Document Overview
**Purpose**: Investor pitch for Series B funding
**Emotional Journey**: Curiosity → Understanding → Excitement → Confidence
**Core Message**: Transform challenge into opportunity through innovation

## Content Analysis

### Slide 1: Opening
**Text**: "Reimagining the Future of Work"

**[IMAGE ANALYSIS]**
Visual: Modern office space with diverse team collaborating
- **Emotional Impact**: Aspirational, inclusive, progressive
- **Deeper Meaning**: Work is evolving beyond traditional boundaries
- **Significance**: Sets tone of innovation and human-centered approach
- **Key Learning**: Visual diversity signals modern values to investors

### Slide 5: Growth Metrics
**[VIDEO ANALYSIS]**
Duration: 30 seconds
- **Visual Journey**: Data visualization morphing from small to large scale
- **Audio**: "In just 18 months, we've transformed how 10,000 companies work"
- **Emotional Arc**: Surprise → Impressed → Confident
- **Hidden Message**: We're not just growing, we're transforming an industry
- **Significance**: Proof of concept at scale builds investor confidence
- **Key Insight**: Dynamic visualization makes data emotionally compelling

## Thematic Synthesis

### Recurring Themes:
1. **Transformation**: Every element reinforces change narrative
2. **Human-Centered**: Technology serves people, not vice versa
3. **Momentum**: Consistent use of upward/forward motion

### Emotional Strategy:
- Opens with aspiration (what's possible)
- Builds with evidence (proof points)
- Closes with invitation (join our journey)

## Document Significance

This presentation masterfully combines:
- Rational arguments (data, metrics)
- Emotional engagement (stories, visuals)
- Strategic messaging (problem-solution-impact)

**Key Learning**: Successful communication requires both logical and emotional persuasion, with visuals carrying the emotional weight while text provides rational support.
```

### 5. Important Analysis Guidelines

#### For Images:
- **Always perform OCR** to extract any text visible in the image
- **Describe visual elements** in detail (colors, composition, subjects)
- **Analyze emotional impact** - what feelings does it evoke?
- **Interpret deeper meaning** - what does it symbolize or represent?
- **Consider context** - how does it support the document's message?
- **Extract learnings** - what can we learn about communication strategy?

#### For Videos:
- **Analyze visual content** frame by frame if needed
- **Transcribe all audio** including speech and music descriptions
- **Track emotional journey** throughout the video
- **Identify messaging layers** (explicit and implicit)
- **Assess production choices** and what they communicate
- **Synthesize insights** from combined audio-visual experience

#### General Principles:
- Go beyond surface-level extraction to deep understanding
- Consider the creator's intent and audience impact
- Identify patterns across different media types
- Provide actionable insights, not just observations
- Remember that every design choice has meaning

### 6. Logging Format
```markdown
# Log: YYYYMMDDHHMMSS

## Processing Started
- Document: [filename]
- Type: [PDF/DOCX/PPTX]
- Total Pages/Slides: [number]
- Images Found: [number]
- Videos Found: [number]

## Analysis Progress
- HH:MM:SS - [Action taken]
- HH:MM:SS - [Finding or insight]

## Deep Insights Captured
- [Key thematic discoveries]
- [Emotional design patterns]
- [Strategic messaging observations]

## Processing Completed
- Duration: [time]
- Output saved to: [location]
```

## Implementation Philosophy

1. **Beyond Extraction**: Don't just extract, understand and interpret
2. **Emotional Intelligence**: Recognize and analyze emotional design
3. **Strategic Thinking**: Understand why choices were made
4. **Holistic View**: See how all elements work together
5. **Actionable Insights**: Provide learnings that can be applied

This approach transforms document processing from mechanical extraction to intelligent understanding, revealing not just what is said, but why it matters.