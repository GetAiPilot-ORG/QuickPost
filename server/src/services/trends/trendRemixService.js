import axios from "axios";

export async function generateTrendRemix({
  title = "",
  caption = "",
  source_platform = "trend",
  source_url = "",
  niche = "general",
  target_platform = "all",
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured on the server.");
  }

  const systemPrompt = `You are a world-class viral content strategist, copywriter, and creative director for top influencers, brand marketers, and founders.
Your job is to take a trending news item, viral video, search surge, or visual idea and generate actionable, high-retention social media remix concepts.

You must output a strictly valid JSON object with the following structure:
{
  "viral_hooks": [
    {
      "style": "Pattern Interrupt",
      "hook": "Catchy 1-sentence hook that stops the scroll immediately"
    },
    {
      "style": "Curiosity Gap",
      "hook": "Intriguing hook that forces viewers to stay until the end"
    },
    {
      "style": "Contrarian Take",
      "hook": "Bold, opinionated statement that challenges the standard opinion"
    }
  ],
  "reel_script": {
    "title": "Short punchy video title",
    "estimated_duration": "35-45s",
    "hook": "0-3s: On-screen visual + spoken words",
    "body_points": [
      "Point 1: Quick setup and shocking context",
      "Point 2: The meat of the insight / how it impacts the audience",
      "Point 3: Actionable takeaway or tip"
    ],
    "call_to_action": "Spoken & text CTA to drive comments/saves"
  },
  "thread_angle": {
    "opening_post": "Engaging hook tweet or LinkedIn lead-in paragraph with a strong hook line",
    "key_insights": [
      "Insight 1: The underlying trend breakdown",
      "Insight 2: What most people get wrong",
      "Insight 3: The future outlook"
    ],
    "closing_post": "Concluding question to spark discussion and foster engagement"
  },
  "carousel_concept": {
    "topic": "Catchy carousel title",
    "slides": [
      { "slide": 1, "heading": "Hook Slide", "text": "Visual hook + provocative headline" },
      { "slide": 2, "heading": "The Context", "text": "What is happening and why it matters" },
      { "slide": 3, "heading": "The Breakdown", "text": "The 3 key lessons or mechanics" },
      { "slide": 4, "heading": "How to Apply", "text": "Direct creator/business application" },
      { "slide": 5, "heading": "Save & Share", "text": "Bookmark for later reminder" }
    ]
  },
  "ready_to_post_caption": "A complete, beautifully formatted social media caption with emojis, bullet points, source acknowledgment, and 5 hyper-targeted hashtags ready for posting."
}

CRITICAL: Return ONLY the JSON object. Do NOT wrap in markdown \`\`\`json or provide any explanatory text.`;

  const userContent = `Trend Item to Remix:
- Title / Headline: ${title}
- Caption & Context: ${caption.slice(0, 1000)}
- Source Platform: ${source_platform}
- Source URL: ${source_url}
- Creator Niche: ${niche}
- Preferred Target Format: ${target_platform}`;

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o-mini", // or gpt-3.5-turbo fallback
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.75,
      response_format: { type: "json_object" },
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 25000,
    }
  );

  const rawJson = response.data?.choices?.[0]?.message?.content;
  try {
    return JSON.parse(rawJson);
  } catch (err) {
    console.error("[TREND-REMIX] Failed to parse OpenAI JSON:", rawJson);
    throw new Error("Invalid AI response formatting. Please try again.");
  }
}
