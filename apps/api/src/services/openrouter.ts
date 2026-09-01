import axios from 'axios';

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

export class OpenRouterService {
  private apiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1';
  private defaultModel = 'openai/gpt-4o-mini';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async sendMessage(
    messages: OpenRouterMessage[],
    options?: Partial<OpenRouterRequest>
  ): Promise<OpenRouterResponse> {
    const requestData: OpenRouterRequest = {
      model: options?.model || this.defaultModel,
      messages,
      max_tokens: options?.max_tokens || 1000,
      temperature: options?.temperature ?? 0.7,
      top_p: options?.top_p ?? 1,
      frequency_penalty: options?.frequency_penalty ?? 0,
      presence_penalty: options?.presence_penalty ?? 0,
      ...options
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://ecom-task-force.com',
            'X-Title': 'Ecoom Task Force'
          },
          timeout: 30000
        }
      );
      return response.data;
    } catch (error) {
      throw new Error(`Falha na comunicação com OpenRouter: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  async askQuestion(question: string, systemPrompt?: string, model?: string): Promise<string> {
    const messages: OpenRouterMessage[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: question });
    const response = await this.sendMessage(messages, { model });
    return response.choices[0]?.message?.content || 'Erro: Resposta vazia do OpenRouter';
  }

  async analyzeLibrary(libraryData: any): Promise<string> {
    return this.askQuestion(
      `Analise esta biblioteca de anúncios do Facebook:\n\n${JSON.stringify(libraryData, null, 2)}`,
      `Você é um especialista em marketing digital e análise de anúncios do Facebook.
Analise os dados da biblioteca fornecida e forneça insights sobre:
- Performance dos anúncios
- Estratégias de targeting
- Oportunidades de melhoria
- Tendências identificadas
- Recomendações específicas
Responda em português brasileiro de forma clara e objetiva.`
    );
  }

  async generateAdSuggestions(adData: any): Promise<string> {
    return this.askQuestion(
      `Analise este anúncio e sugira melhorias:\n\n${JSON.stringify(adData, null, 2)}`,
      `Você é um copywriter especialista em anúncios do Facebook.
Analise o anúncio fornecido e sugira melhorias para:
- Títulos mais atraentes
- Descrições mais persuasivas
- Call-to-actions mais eficazes
- Estratégias de targeting
- Elementos visuais
Responda em português brasileiro com sugestões práticas e específicas.`
    );
  }

  async getAvailableModels(): Promise<any> {
    const response = await axios.get(`${this.baseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  }
}

let openRouterService: OpenRouterService | null = null;

export function getOpenRouterService(): OpenRouterService {
  if (!openRouterService) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY não configurada nas variáveis de ambiente');
    openRouterService = new OpenRouterService(apiKey);
  }
  return openRouterService;
}
