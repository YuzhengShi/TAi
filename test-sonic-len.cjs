// Test if it's a length issue — pad working prompt with harmless text
const { BedrockRuntimeClient, InvokeModelWithBidirectionalStreamCommand } = require("@aws-sdk/client-bedrock-runtime");
const { WebSocketFetchHandler } = require("@aws-sdk/middleware-websocket");
const fs = require("fs");

const client = new BedrockRuntimeClient({ region: "us-east-1", requestHandler: new WebSocketFetchHandler({connectionTimeout:5000}) });
const enc = new TextEncoder();

const ctx = JSON.parse(fs.readFileSync("/data/groups/yuzheng/interview_context.json", "utf8"));

const base = "You are TAi, a friendly grad-student TA for CS6650 at Northeastern. Mock interview with " + ctx.studentName + " about " + ctx.assignmentName + ". Keep it casual. One sentence per turn.\n\n" + ctx.assignmentName + ":\n" + (ctx.assignmentSpec || "") + "\n\n" + (ctx.lectureContent || "") + "\n\nOpen with: hey " + ctx.studentName.split(" ")[0] + ", hows it going?";

const toolDef = {toolSpec:{name:"evaluate_answer",description:"Evaluate.",inputSchema:{json:JSON.stringify({type:"object",properties:{q:{type:"string"},a:{type:"string"},t:{type:"string"}},required:["q","a","t"]})}}};

async function testLen(targetLen) {
  // Pad with harmless lorem text
  let prompt = base;
  const padding = "\n\nAdditional context about distributed systems: Distributed systems involve multiple computers working together. Key concepts include consistency, availability, partition tolerance, replication, sharding, load balancing, and fault tolerance. Students should understand CAP theorem, consensus protocols like Paxos and Raft, and message queues like Kafka. ";
  while (prompt.length < targetLen) prompt += padding;
  prompt = prompt.slice(0, targetLen);

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
    console.log("OK      " + targetLen + " chars");
    return true;
  } catch(e) {
    if (e.message && e.message.includes("content filters")) {
      console.log("BLOCKED " + targetLen + " chars");
    } else {
      console.log("ERROR   " + targetLen + " chars: " + (e.message||"").slice(0,80));
    }
    return false;
  }
}

(async () => {
  // Test lengths: 4000, 5000, 6000, 7000, 8000, 9000, 10000
  for (const len of [4000, 5000, 6000, 7000, 8000, 9000, 10000]) {
    await testLen(len);
    await new Promise(r => setTimeout(r, 1000));
  }
})();
