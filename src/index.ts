import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error(
      "Missing OPENAI_API_KEY environment variable.\n" +
      "Get one at https://platform.openai.com/api-keys then:\n" +
      "  export OPENAI_API_KEY=sk-..."
    );
    process.exit(1);
  }
  return new OpenAI({ apiKey });
}

function readDirRecursive(dir: string, maxFiles = 20): string {
  let content = "";
  let count = 0;
  function walk(d: string) {
    if (count >= maxFiles) return;
    if (!fs.existsSync(d)) return;
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      if (count >= maxFiles) break;
      if (e.name === "node_modules" || e.name === ".git") continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) { walk(full); }
      else if (/\.(ts|js|tsx|jsx)$/.test(e.name)) {
        content += `\n--- ${full} ---\n${fs.readFileSync(full, "utf-8").slice(0, 3000)}\n`;
        count++;
      }
    }
  }
  walk(dir);
  return content;
}

export async function auditAuth(dir: string): Promise<string> {
  const openai = getOpenAI();
  const code = readDirRecursive(dir);
  if (!code.trim()) {
    return "No source files found in " + dir;
  }
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: `You are a security auditor specializing in authentication. Analyze the code and check for: password hashing (bcrypt/argon2), JWT implementation flaws, session management issues, CSRF protection, rate limiting, input validation, SQL injection, privilege escalation, token expiry, secure cookie settings. Rate severity (critical/high/medium/low). Provide specific fix suggestions with code examples.` },
      { role: "user", content: `Audit this auth implementation:\n\n${code}` }
    ],
    temperature: 0.3,
  });
  return response.choices[0].message.content || "";
}
