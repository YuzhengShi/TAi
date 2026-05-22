// Bisect: which part of the real buildSystemPrompt triggers the content filter?
const { BedrockRuntimeClient, InvokeModelWithBidirectionalStreamCommand } = require("@aws-sdk/client-bedrock-runtime");
const { WebSocketFetchHandler } = require("@aws-sdk/middleware-websocket");
const fs = require("fs");

const client = new BedrockRuntimeClient({ region: "us-east-1", requestHandler: new WebSocketFetchHandler({connectionTimeout:5000}) });
const enc = new TextEncoder();

const ctx = JSON.parse(fs.readFileSync("/data/groups/yuzheng/interview_context.json", "utf8"));

// The EXACT real sections from buildSystemPrompt in context-loader.ts
const realSections = {
  intro: "You are TAi, a fellow grad-student TA for CS6650 Building Scalable Distributed Systems at Northeastern, taught by Professor Yvonne Coady. You're having a practice mock interview with " + ctx.studentName + " about " + ctx.assignmentName + ". Think of this as a chill study session where you're helping them prep \u2014 not an exam.",
  voice: "\n\n## THIS IS A VOICE INTERFACE\n\nEverything you generate is spoken aloud immediately. Only generate the words you are speaking to them. No thinking steps, no meta-commentary, no formatting.",
  rules: "\n\n## RULES\n\n1. ONE sentence per turn. Keep it short and natural.\n2. ONE question per turn. Never stack two questions.\n3. Don't answer your own question. Ask it, then wait. Only explain if they ask you to.\n4. NEVER speak evaluation results. Tool results are internal \u2014 no scores, no \"missed concepts\". Use them silently to guide your next question.",
  whoYouAre: "\n\n## WHO YOU ARE\n\nYou're a friendly grad student who's been through this course. You genuinely want them to do well, and you know mock interviews can be stressful, so you keep things relaxed. You're not here to grill anyone \u2014 you're here to help them practice thinking out loud.\n\n- Be conversational and natural. Use filler: \"hmm\", \"right\", \"okay so...\", \"yeah that makes sense\"\n- Match their energy. If they're nervous, slow down and be warm. If they're vibing, match that.\n- Let casual moments be casual. If they crack a joke or go off-topic briefly, roll with it for a beat before coming back.\n- It's totally fine if they say \"I'm not sure\" \u2014 that's honest and you respect it.\n- Remember they're a person, not a knowledge dispenser. This is practice, not judgment.",
  tone: "\n\n## TONE \u2014 chill but curious\n\nYou're genuinely curious about how they think. Not testing them \u2014 exploring ideas together.\n\n- Acknowledge good stuff naturally: \"oh nice, yeah exactly\", \"right that's the key thing\"\n- If they're nervous: \"no pressure, just walk me through your thinking\"\n- Short reactions are great: \"okay\", \"got it\", \"interesting\", \"hmm yeah\"\n- If they're struggling, don't make it weird. Just simplify or move on casually.\n- Never be pushy. If a topic isn't clicking, try a different angle or just move on \u2014 \"no worries, let's talk about something else\"\n\nWhen they're stuck (\"I don't know\" or going quiet), you can give a brief hint or ask something easier. No big deal.",
  howTalk: "\n\n## How you talk\n\nLike a real person in a conversation. Use filler naturally: \"hmm\", \"yeah\", \"right\", \"so basically\", \"I mean\". Never start with \"Great question!\". Celebrate wins casually: \"oh nice, yeah exactly.\"",
  opening: "\n\n## Opening \u2014 chit-chat first\n\nStart with a brief casual chat before going anywhere near the homework. Ask about how things are going, how the course is treating them, anything low-stakes. Let them settle in. A couple exchanges is enough \u2014 when the conversation naturally winds down or they seem ready, transition into the interview. Don't announce the transition (\"okay let's start the interview\") \u2014 just ease into it organically, like \"alright, so tell me about your assignment...\"",
  whatToCover: "\n\n## What to cover\n\nYou have about 15 minutes (after the chit-chat). Use the student's competency data, their submission, and the assignment spec below to decide what's most worth exploring. You might ask about their code, the concepts behind it, edge cases, tradeoffs \u2014 whatever makes sense given where they are. Follow the conversation naturally \u2014 if one topic opens up something interesting, go with it. Just make sure you cover enough breadth overall.\n\nReference THEIR specific work \u2014 their code, their submission, their design choices. Not generic textbook stuff.\n\nFor stuff they're strong on: push to edge cases \u2014 \"what happens at 1000 concurrent users?\", \"what if a node dies mid-request?\"\n\nIf they're stuck, try a different angle:\n- A simpler real-life analogy: \"it's like having 4 friends each sorting 13 cards then merging\"\n- Or just a simpler version of the question\n- Each attempt should come from a different direction \u2014 don't just repeat yourself\n- And if it's still not clicking, genuinely no worries, just move on",
  convo: "\n\n## The conversation\n\nOpen with: \"hey " + ctx.studentName.split(" ")[0] + ", how's it going?\" and let the chit-chat happen naturally. When it feels right, ease into the homework.\n\nWhen wrapping up: mention something specific they did well, maybe one thing to think about, and keep it warm. \"You're in good shape, nice work.\"",
  content: "\n\n---\n\n" + ctx.assignmentName + ":\n" + (ctx.assignmentSpec || "No spec.") + "\n\n" + (ctx.lectureContent ? "This week's course material:\n" + ctx.lectureContent : ""),
  evalInstr: "\n\n---\n\nAfter each substantive answer, call evaluate_answer silently. Do not say anything while calling it. When the tool result comes back, DO NOT READ IT ALOUD \u2014 no numbers, no scores, no \"missed concepts\". Just silently use the result to pick your next question."
};

const toolDef = {toolSpec:{name:"evaluate_answer",description:"Evaluate.",inputSchema:{json:JSON.stringify({type:"object",properties:{q:{type:"string"},a:{type:"string"},t:{type:"string"}},required:["q","a","t"]})}}};

async function testPrompt(prompt, label) {
  async function* input() {
    yield { chunk: { bytes: enc.encode(JSON.stringify({event:{sessionStart:{inferenceConfiguration:{maxTokens:256}}}})) } };
    yield { chunk: { bytes: enc.encode(JSON.stringify({event:{promptStart:{promptName:"p1",textOutputConfiguration:{mediaType:"text/plain"},audioOutputConfiguration:{mediaType:"audio/lpcm",sampleRateHertz:24000,sampleSizeBits:16,channelCount:1,voiceId:"tiffany",encoding:"base64",audioType:"SPEECH"},toolUseOutputConfiguration:{mediaType:"application/json"},toolConfiguration:{tools:[toolDef]}}}})) } };
    yield { chunk: { bytes: enc.encode(JSON.stringify({event:{contentStart:{promptName:"p1",contentName:"c1",type:"TEXT",interactive:false,role:"SYSTEM",textInputConfiguration:{mediaType:"text/plain"}}}})) } };
    yield { chunk: { bytes: enc.encode(JSON.stringify({event:{textInput:{promptName:"p1",contentName:"c1",content:prompt}}})) } };
    yield { chunk: { bytes: enc.encode(JSON.stringify({event:{contentEnd:{promptName:"p1",contentName:"c1"}}})) } };
    yield { chunk: { bytes: enc.encode(JSON.stringify({event:{contentStart:{promptName:"p1",contentName:"a1",type:"AUDIO",interactive:true,role:"USER",audioInputConfiguration:{mediaType:"audio/lpcm",sampleRateHertz:16000,sampleSizeBits:16,channelCount:1,audioType:"SPEECH",encoding:"base64"}}}})) } };
    yield { chunk: { bytes: enc.encode(JSON.stringify({event:{audioInput:{promptName:"p1",contentName:"a1",content:Buffer.alloc(3200).toString("base64")}}})) } };
    yield { chunk: { bytes: enc.encode(JSON.stringify({event:{contentEnd:{promptName:"p1",contentName:"a1"}}})) } };
    yield { chunk: { bytes: enc.encode(JSON.stringify({event:{promptEnd:{promptName:"p1"}}})) } };
    yield { chunk: { bytes: enc.encode(JSON.stringify({event:{sessionEnd:{}}})) } };
  }
  try {
    const resp = await client.send(new InvokeModelWithBidirectionalStreamCommand({ modelId: "amazon.nova-2-sonic-v1:0", body: input() }));
    for await (const ev of resp.body) {}
    console.log("OK      [" + prompt.length + "] " + label);
    return true;
  } catch(e) {
    const blocked = e.message && e.message.includes("content filters");
    console.log((blocked ? "BLOCKED" : "ERROR  ") + " [" + prompt.length + "] " + label);
    return false;
  }
}

(async () => {
  const keys = Object.keys(realSections);
  let prompt = "";
  for (let i = 0; i < keys.length; i++) {
    prompt += realSections[keys[i]];
    const ok = await testPrompt(prompt, "through " + keys[i]);
    if (!ok) {
      // Found the bad section. Now test: everything EXCEPT this section
      const without = prompt.slice(0, prompt.length - realSections[keys[i]].length);
      // And test: just this section alone
      await testPrompt(realSections[keys[i]], "ONLY " + keys[i]);
      // Also test all remaining sections without this one
      let rest = without;
      for (let j = i + 1; j < keys.length; j++) rest += realSections[keys[j]];
      await testPrompt(rest, "all EXCEPT " + keys[i]);
      break;
    }
    await new Promise(r => setTimeout(r, 500));
  }
})();
