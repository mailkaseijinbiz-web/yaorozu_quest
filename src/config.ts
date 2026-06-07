// src/config.ts

import fs from 'fs';
import path from 'path';

interface LocalLLMConfig {
  endpoint: string;
  model: string;
  headers?: Record<string, string>;
  // optional generation parameters
  maxTokens?: number;
  temperature?: number;
}

const CONFIG_PATH = path.resolve(process.cwd(), 'local_llm_config.json');
let localLLMConfig: LocalLLMConfig | null = null;
let useLocalLLM = false;

if (fs.existsSync(CONFIG_PATH)) {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    localLLMConfig = JSON.parse(raw) as LocalLLMConfig;
    useLocalLLM = true; // always active as per requirement
  } catch (e) {
    console.error('Failed to parse local_llm_config.json:', e);
    // keep defaults (null, false)
  }
}

export { localLLMConfig, useLocalLLM };
