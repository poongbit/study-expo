import http from "node:http";
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY가 없습니다.");
}

const ai = new GoogleGenAI({ apiKey });

// Output schema: exactly three fields, each ≤ 100 characters.
// Gemini polishes the wording of a locally-confirmed diagnosis;
// it does NOT generate free-form diagnoses from raw data.
const feedbackSchema = {
  type: "object",
  properties: {
    coreProblem: {
      type: "string",
      description: "이번 세트의 핵심 문제 한 문장 (100자 이내)",
    },
    evidence: {
      type: "string",
      description: "방향 또는 전후 비교를 포함한 숫자 근거 한 문장 (100자 이내)",
    },
    nextAction: {
      type: "string",
      description: "다음 20회에서 바꿀 행동 한 문장 (100자 이내)",
    },
  },
  required: ["coreProblem", "evidence", "nextAction"],
  additionalProperties: false,
};

function send(res, status, value) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(value));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    send(res, 204, {});
    return;
  }

  if (req.method !== "POST" || req.url !== "/feedback") {
    send(res, 404, { error: "Not found" });
    return;
  }

  try {
    let body = "";

    for await (const chunk of req) {
      body += chunk;

      if (body.length > 50_000) {
        throw new Error("요청이 너무 큽니다.");
      }
    }

    // The client sends only numeric summaries and a confirmed diagnosis code.
    // Raw stroke coordinate arrays are NEVER included in the text prompt.
    const payload = JSON.parse(body);

    // Remove any raw coordinate data before passing to the model (defense-in-depth).
    const { overlayStrokes: _overlay, strokeBatch: _batch, ...safePayload } = payload;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: `당신은 그림을 처음 배우는 사람을 위한 드로잉 코치입니다.

아래 측정 요약에 명시된 사실만 사용하세요.
사용자의 성격, 재능, 신체 상태를 추측하지 마세요.
반드시 다음 세 필드만 출력하고, 각 문장은 100자 이내로 제한하세요.

- coreProblem: 이번 세트의 핵심 문제 한 문장
- evidence: 방향 또는 전후 비교를 포함한 숫자 근거 한 문장
- nextAction: 다음 20회에서 바꿀 행동 한 문장

측정 요약:
${JSON.stringify(safePayload)}
`,
      config: {
        temperature: 0.1,
        maxOutputTokens: 260,
        responseMimeType: "application/json",
        responseSchema: feedbackSchema,
      },
    });

    const feedback = JSON.parse(response.text);
    send(res, 200, feedback);
  } catch (error) {
    console.error(error);
    send(res, 500, { error: "피드백을 생성하지 못했습니다." });
  }
});

server.listen(Number(process.env.PORT ?? 8787), "0.0.0.0", () => {
  console.log("Feedback server: http://localhost:8787");
});
