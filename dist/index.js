"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditAuth = auditAuth;
const openai_1 = __importDefault(require("openai"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function getOpenAI() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.error("Missing OPENAI_API_KEY environment variable.\n" +
            "Get one at https://platform.openai.com/api-keys then:\n" +
            "  export OPENAI_API_KEY=sk-...");
        process.exit(1);
    }
    return new openai_1.default({ apiKey });
}
function readDirRecursive(dir, maxFiles = 20) {
    let content = "";
    let count = 0;
    function walk(d) {
        if (count >= maxFiles)
            return;
        if (!fs.existsSync(d))
            return;
        const entries = fs.readdirSync(d, { withFileTypes: true });
        for (const e of entries) {
            if (count >= maxFiles)
                break;
            if (e.name === "node_modules" || e.name === ".git")
                continue;
            const full = path.join(d, e.name);
            if (e.isDirectory()) {
                walk(full);
            }
            else if (/\.(ts|js|tsx|jsx)$/.test(e.name)) {
                content += `\n--- ${full} ---\n${fs.readFileSync(full, "utf-8").slice(0, 3000)}\n`;
                count++;
            }
        }
    }
    walk(dir);
    return content;
}
async function auditAuth(dir) {
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
