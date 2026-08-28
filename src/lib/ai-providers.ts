/**
 * AI 提供商预设（OpenAI 兼容 Chat Completions）
 *
 * 这里聚合了 Cursor 常调用的模型对应的第三方接口：
 * 只要能走 OpenAI 兼容的 `/chat/completions`（含 Vision 多模态），
 * 就能同时喂给站内「一键翻译」与「MathCode 公式识别」。
 *
 * 每条记录：
 *   - baseUrl：直接填入设置面板的 Base URL（不含 /chat/completions）
 *   - defaultModel：面板默认填的模型；vision 优先选带视觉的
 *   - models：常用型号建议列表（不强制枚举，用户可自行覆盖）
 *   - vision：是否含视觉能力（MathCode 必须选 vision=true 的模型）
 *   - region：cn=大陆直连友好；global=需科学上网；both=一般都能连
 *   - notes：中文备注（申请 Key 的入口 / 使用建议）
 *
 * 增删提供商时，只改本表；面板下拉与提示会自动跟随。
 */

export type AiProviderRegion = "cn" | "global" | "both";

export type AiProviderModel = {
  id: string;
  /** 中文/英文均可，展示用 */
  label: string;
  vision?: boolean;
  /** 高性价比默认；有多个模型时用于排序/推荐 */
  recommended?: boolean;
};

export type AiProviderPreset = {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  region: AiProviderRegion;
  vision: boolean;
  models: AiProviderModel[];
  applyUrl?: string;
  notes?: string;
};

/** 顺序即下拉展示顺序：先大陆友好，再全球通用，最后聚合/其他 */
export const AI_PROVIDER_PRESETS: AiProviderPreset[] = [
  {
    id: "aliyun-dashscope",
    name: "阿里云百炼 / DashScope（通义千问 Qwen）",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-vl-max",
    region: "cn",
    vision: true,
    models: [
      { id: "qwen-vl-max", label: "qwen-vl-max（视觉，推荐 MathCode）", vision: true, recommended: true },
      { id: "qwen-vl-plus", label: "qwen-vl-plus（视觉，性价比）", vision: true },
      { id: "qwen-max", label: "qwen-max（纯文本）" },
      { id: "qwen-plus", label: "qwen-plus（纯文本，翻译性价比）", recommended: true },
      { id: "qwen-turbo", label: "qwen-turbo（更便宜）" },
    ],
    applyUrl: "https://bailian.console.aliyun.com/",
    notes: "大陆直连、账单走阿里云；MathCode 选 qwen-vl-max，翻译可用 qwen-plus。",
  },
  {
    id: "moonshot",
    name: "月之暗面 Moonshot / Kimi",
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k-vision-preview",
    region: "cn",
    vision: true,
    models: [
      { id: "moonshot-v1-8k-vision-preview", label: "moonshot-v1-8k-vision（视觉）", vision: true, recommended: true },
      { id: "moonshot-v1-32k-vision-preview", label: "moonshot-v1-32k-vision（视觉，长上下文）", vision: true },
      { id: "moonshot-v1-8k", label: "moonshot-v1-8k（纯文本）" },
      { id: "moonshot-v1-128k", label: "moonshot-v1-128k（长上下文）" },
      { id: "kimi-latest", label: "kimi-latest（跟随最新 K2）", recommended: true },
    ],
    applyUrl: "https://platform.moonshot.cn/console/api-keys",
    notes: "大陆直连；Vision 模型可用于 MathCode。",
  },
  {
    id: "deepseek",
    name: "DeepSeek 深度求索",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-v4-flash-vision-exp",
    region: "cn",
    vision: true,
    models: [
      // 2026-08-21 官方上线的实验性视觉模型：$0.22/M 输入、$0.66/M 输出，一张图 ≤384 tokens
      { id: "deepseek-v4-flash-vision-exp", label: "deepseek-v4-flash-vision-exp（视觉，MathCode 首选）", vision: true, recommended: true },
      { id: "deepseek-chat", label: "deepseek-chat（文本，翻译性价比）", recommended: true },
      { id: "deepseek-reasoner", label: "deepseek-reasoner（推理，慢，无视觉）" },
    ],
    applyUrl: "https://platform.deepseek.com/api_keys",
    notes: "大陆直连、极便宜。视觉走 deepseek-v4-flash-vision-exp（实验版，接口可能变动）；翻译用 deepseek-chat。",
  },
  {
    id: "zhipu-glm",
    name: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4v-plus",
    region: "cn",
    vision: true,
    models: [
      { id: "glm-4v-plus", label: "glm-4v-plus（视觉）", vision: true, recommended: true },
      { id: "glm-4-plus", label: "glm-4-plus（文本旗舰）" },
      { id: "glm-4-air", label: "glm-4-air（性价比）", recommended: true },
      { id: "glm-4-flash", label: "glm-4-flash（免费额度）" },
    ],
    applyUrl: "https://open.bigmodel.cn/usercenter/apikeys",
    notes: "大陆直连；glm-4-flash 有免费额度，可先跑通再上量。",
  },
  {
    id: "volcengine-ark",
    name: "火山方舟 / 豆包 Doubao",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "doubao-1-5-vision-pro-32k",
    region: "cn",
    vision: true,
    models: [
      { id: "doubao-1-5-vision-pro-32k", label: "doubao-1.5-vision-pro（视觉）", vision: true, recommended: true },
      { id: "doubao-1-5-pro-32k", label: "doubao-1.5-pro-32k（文本）", recommended: true },
      { id: "doubao-1-5-lite-32k", label: "doubao-1.5-lite-32k（便宜）" },
    ],
    applyUrl: "https://console.volcengine.com/ark",
    notes:
      "字节大陆直连；模型 ID 需在方舟控制台创建「推理接入点」后填该 endpoint ID（形如 ep-2026… ），或直接使用官方公共模型 ID。",
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    region: "global",
    vision: true,
    models: [
      { id: "gpt-4o-mini", label: "gpt-4o-mini（视觉+便宜，推荐）", vision: true, recommended: true },
      { id: "gpt-4o", label: "gpt-4o（视觉，旗舰）", vision: true },
      { id: "gpt-4.1", label: "gpt-4.1（视觉，长上下文）", vision: true },
      { id: "gpt-4.1-mini", label: "gpt-4.1-mini（视觉）", vision: true },
      { id: "o4-mini", label: "o4-mini（推理，视觉）", vision: true },
      { id: "gpt-5", label: "gpt-5（若已开通）", vision: true },
    ],
    applyUrl: "https://platform.openai.com/api-keys",
    notes: "全球最通用；大陆需自备出海。MathCode 首选 gpt-4o-mini。",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude（OpenAI 兼容）",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-5",
    region: "global",
    vision: true,
    models: [
      { id: "claude-sonnet-4-5", label: "claude-sonnet-4.5（视觉，推荐）", vision: true, recommended: true },
      { id: "claude-opus-4-1", label: "claude-opus-4.1（视觉，旗舰）", vision: true },
      { id: "claude-haiku-4-5", label: "claude-haiku-4.5（视觉，便宜）", vision: true },
      { id: "claude-3-7-sonnet-latest", label: "claude-3.7-sonnet（视觉）", vision: true },
      { id: "claude-3-5-sonnet-latest", label: "claude-3.5-sonnet（视觉）", vision: true },
    ],
    applyUrl: "https://console.anthropic.com/settings/keys",
    notes:
      "使用 Anthropic 官方 OpenAI 兼容层；大陆需自备出海。若失败可改走 OpenRouter 转发。",
  },
  {
    id: "google-gemini",
    name: "Google Gemini（OpenAI 兼容）",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.5-flash",
    region: "global",
    vision: true,
    models: [
      { id: "gemini-2.5-flash", label: "gemini-2.5-flash（视觉，性价比推荐）", vision: true, recommended: true },
      { id: "gemini-2.5-pro", label: "gemini-2.5-pro（视觉，旗舰）", vision: true },
      { id: "gemini-2.0-flash", label: "gemini-2.0-flash（视觉，便宜）", vision: true },
      { id: "gemini-2.0-flash-lite", label: "gemini-2.0-flash-lite（视觉，更便宜）", vision: true },
    ],
    applyUrl: "https://aistudio.google.com/apikey",
    notes: "大陆需自备出海；Flash 系列有免费额度，可先试。",
  },
  {
    id: "xai-grok",
    name: "xAI Grok",
    baseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-4",
    region: "global",
    vision: true,
    models: [
      { id: "grok-4", label: "grok-4（视觉，推荐）", vision: true, recommended: true },
      { id: "grok-4-fast", label: "grok-4-fast（更快）", vision: true },
      { id: "grok-3", label: "grok-3（视觉）", vision: true },
      { id: "grok-code-fast-1", label: "grok-code-fast（代码）" },
    ],
    applyUrl: "https://console.x.ai/",
    notes: "大陆需自备出海。",
  },
  {
    id: "openrouter",
    name: "OpenRouter（聚合，一号多模型）",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4o-mini",
    region: "global",
    vision: true,
    models: [
      { id: "openai/gpt-4o-mini", label: "openai/gpt-4o-mini（视觉，便宜）", vision: true, recommended: true },
      { id: "openai/gpt-4o", label: "openai/gpt-4o（视觉）", vision: true },
      { id: "anthropic/claude-sonnet-4.5", label: "anthropic/claude-sonnet-4.5（视觉）", vision: true },
      { id: "anthropic/claude-opus-4.1", label: "anthropic/claude-opus-4.1（视觉）", vision: true },
      { id: "google/gemini-2.5-flash", label: "google/gemini-2.5-flash（视觉）", vision: true },
      { id: "google/gemini-2.5-pro", label: "google/gemini-2.5-pro（视觉）", vision: true },
      { id: "x-ai/grok-4", label: "x-ai/grok-4（视觉）", vision: true },
      { id: "deepseek/deepseek-chat", label: "deepseek/deepseek-chat" },
      { id: "meta-llama/llama-3.3-70b-instruct", label: "meta-llama/llama-3.3-70b" },
    ],
    applyUrl: "https://openrouter.ai/keys",
    notes: "一个 Key 打通几十家；大陆需自备出海。推荐用于 A/B 对比不同模型。",
  },
  {
    id: "groq",
    name: "Groq（极速推理）",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    region: "global",
    vision: false,
    models: [
      { id: "llama-3.3-70b-versatile", label: "llama-3.3-70b-versatile", recommended: true },
      { id: "llama-3.1-8b-instant", label: "llama-3.1-8b-instant（极快）" },
      { id: "mixtral-8x7b-32768", label: "mixtral-8x7b-32768" },
    ],
    applyUrl: "https://console.groq.com/keys",
    notes: "推理速度极快、文本免费额度大；无视觉，MathCode 不适用。",
  },
  {
    id: "together",
    name: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    region: "global",
    vision: false,
    models: [
      { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo", label: "Llama-3.3-70B-Instruct-Turbo", recommended: true },
      { id: "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo", label: "Llama-3.1-405B-Instruct-Turbo" },
      { id: "Qwen/Qwen2.5-72B-Instruct-Turbo", label: "Qwen2.5-72B-Instruct-Turbo" },
    ],
    applyUrl: "https://api.together.ai/settings/api-keys",
    notes: "开源模型托管；大陆需自备出海。",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    baseUrl: "https://api.perplexity.ai",
    defaultModel: "sonar-pro",
    region: "global",
    vision: false,
    models: [
      { id: "sonar-pro", label: "sonar-pro（带联网搜索）", recommended: true },
      { id: "sonar", label: "sonar（更便宜）" },
      { id: "sonar-reasoning", label: "sonar-reasoning" },
    ],
    applyUrl: "https://www.perplexity.ai/settings/api",
    notes: "长于联网检索；无视觉，MathCode 不适用。",
  },
  {
    id: "custom",
    name: "自定义（其他 OpenAI 兼容接口）",
    baseUrl: "",
    defaultModel: "",
    region: "both",
    vision: false,
    models: [],
    notes: "任何暴露 /chat/completions 的 OpenAI 兼容端点均可；请自行填写。",
  },
];

/** 用于面板下拉「视觉能力」标注 */
export const AI_PROVIDER_MAP: Record<string, AiProviderPreset> =
  AI_PROVIDER_PRESETS.reduce(
    (acc, p) => {
      acc[p.id] = p;
      return acc;
    },
    {} as Record<string, AiProviderPreset>,
  );

/** 根据 baseUrl（+ 可选 model）反查目前用的是哪个预设，找不到则视为「自定义」 */
export function findProviderPreset(input: {
  baseUrl?: string;
  model?: string;
}): AiProviderPreset {
  const base = (input.baseUrl || "").trim().replace(/\/+$/, "");
  const hit = AI_PROVIDER_PRESETS.find(
    (p) => p.baseUrl && p.baseUrl.replace(/\/+$/, "") === base,
  );
  return hit || AI_PROVIDER_MAP.custom;
}

export const REGION_LABEL: Record<AiProviderRegion, string> = {
  cn: "大陆直连",
  global: "海外",
  both: "通用",
};
