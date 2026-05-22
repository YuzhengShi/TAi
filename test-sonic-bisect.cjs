// Bisect Nova Sonic content filter — test with progressively larger prompt chunks
const { BedrockRuntimeClient, InvokeModelWithBidirectionalStreamCommand } = require("@aws-sdk/client-bedrock-runtime");
const { WebSocketFetchHandler } = require("@aws-sdk/middleware-websocket");
const fs = require("fs");

const client = new BedrockRuntimeClient({ region: "us-east-1", requestHandler: new WebSocketFetchHandler({connectionTimeout:5000}) });
const enc = new TextEncoder();

const ctx = JSON.parse(fs.readFileSync("/data/groups/yuzheng/interview_context.json", "utf8"));

// Build the full prompt in sections
const sections = [
  // Section 0: minimal
  "You are TAi, a friendly grad-student TA for CS6650 at Northeastern. Mock interview with " + ctx.studentName + " about " + ctx.assignmentName + ".",
  // Section 1: voice interface rules
  "\n\n## THIS IS A VOICE INTERFACE\nEverything you generate is spoken aloud immediately. Only generate the words you are speaking to them.\n\n## RULES\n1. ONE sentence per turn.\n2. ONE question per turn.\n3. Don't answer your own question.\n4. NEVER speak evaluation results aloud.",
  // Section 2: persona
  "\n\n## WHO YOU ARE\nYou're a friendly grad student who's been through this course. You genuinely want them to do well, and you know mock interviews can be stressful, so you keep things relaxed. You're not here to grill anyone \u2014 you're here to help them practice thinking out loud.\n- Be conversational and natural.\n- Match their energy.\n- It's totally fine if they say \"I'm not sure\".",
  // Section 3: tone
  "\n\n## TONE\nYou're genuinely curious about how they think. Not testing them \u2014 exploring ideas together.\n- Acknowledge good stuff naturally\n- If they're nervous: \"no pressure, just walk me through your thinking\"\n- If they're struggling, don't make it weird. Just simplify or move on.",
  // Section 4: opening instructions
  "\n\n## Opening\nStart with casual chat. Ask how things are going. When ready, ease into homework organically.\n\n## What to cover\nYou have about 15 minutes. Reference THEIR specific work. For strong topics push to edge cases. If stuck, try a different angle.\n\nOpen with: \"hey " + ctx.studentName.split(" ")[0] + ", how's it going?\"",
  // Section 5: assignment spec
  "\n\n---\n\n" + ctx.assignmentName + ":\n" + (ctx.assignmentSpec || "No spec."),
  // Section 6: lecture content
  "\n\n" + (ctx.lectureContent || ""),
  // Section 7: eval instructions
  "\n\n---\n\nAfter each substantive answer, call evaluate_answer silently. Do not say anything while calling it. DO NOT READ IT ALOUD."
];

const toolDef = {toolSpec:{name:"evaluate_answer",description:"Evaluate the student answer.",inputSchema:{json:JSON.stringify({type:"object",properties:{question_asked:{type:"string"},student_answer_summary:{type:"string"},topic:{type:"string"}},required:["question_asked","student_answer_summary","topic"]})}}};

async function testPrompt(prompt, label) {
  async function* input() {
    yield { chunk: { bytes: enc.encode(JSON.stringify({event:{sessionStart:{inferenceConfiguration:{maxTokens:256,topP:0.9,temperature:0.7}}}})) } };
    yield { chunk: { bytes: enc.encode(JSON.stringify({event:{promptStart:{promptName:"p1",textOutputConfiguration:{mediaType:"text/plain"},audioOutputConfiguration:{mediaType:"audio/lpcm",sampleRateHertz:24000,sampleSizeBits:16,channelCount:1,voiceId:"tiffany",encoding:"base64",audioType:"SPEECH"},toolUseOutputConfiguration:{mediaType:"application/json"},toolConfiguration:{tools:[toolDef]}}}})) } };
    yield { chunk: { bytes: enc.encode(JSON.stringify({event:{contentStart:{promptName:"p1",contentName:"c1",type:"TEXT",interactive:false,role:"SYSTEM",textInputConfiguration:{mediaType:"text/plain"}}}})) } };
    yield { chunk: { bytes: enc.encode(JSON.stringify({event:{textInput:{promptName:"p1",contentName:"c1",content:prompt}}})) } };
    yield { chunk: { bytes: enc.encode(JSON.stringify({event:{contentEnd:{promptName:"p1",contentName:"c1"}}})) } };
    yield { chunk: { bytes: enc.encode(JSON.stringify({event:{contentStart:{promptName:"p1",contentName:"a1",type:"AUDIO",interactive:true,role:"USER",audioInputConfiguration:{mediaType:"audio/lpcm",sampleRateHertz:16000,sampleSizeBits:16,channelCount:1,audioType:"SPEECH",encoding:"base64"}}}})) } };
    const silence = Buffer.alloc(3200).toString("base64");
    for (let i = 0; i < 5; i++) yield { chunk: { bytes: enc.encode(JSON.stringify({event:{audioInput:{promptName:"p1",contentName:"a1",content:silence}}})) } };
    yield { chunk: { bytes: enc.encode(JSON.stringify({event:{contentEnd:{promptName:"p1",contentName:"a1"}}})) } };
    yield { chunk: { bytes: enc.encode(JSON.stringify({event:{promptEnd:{promptName:"p1"}}})) } };
    yield { chunk: { bytes: enc.encode(JSON.stringify({event:{sessionEnd:{}}})) } };
  }
  try {
    const resp = await client.send(new InvokeModelWithBidirectionalStreamCommand({ modelId: "amazon.nova-2-sonic-v1:0", body: input() }));
    for await (const ev of resp.body) { /* drain */ }
    console.log("OK   [" + prompt.length + " chars] " + label);
    return true;
  } catch(e) {
    if (e.message && e.message.includes("content filters")) {
      console.log("BLOCKED [" + prompt.length + " chars] " + label);
    } else {
      console.log("ERROR [" + prompt.length + " chars] " + label + ": " + (e.message||"").slice(0,100));
    }
    return false;
  }
}

(async () => {
  let prompt = "";
  for (let i = 0; i < sections.length; i++) {
    prompt += sections[i];
    const ok = await testPrompt(prompt, "sections 0-" + i);
    if (!ok) {
      // Bisect within this section
      const prevPrompt = prompt.slice(0, prompt.length - sections[i].length);
      const sec = sections[i];
      // Test with just half
      const half = prevPrompt + sec.slice(0, Math.floor(sec.length / 2));
      await testPrompt(half, "sections 0-" + (i-1) + " + first half of " + i);
      break;
    }
    // Rate limit
    await new Promise(r => setTimeout(r, 1000));
  }
})();
