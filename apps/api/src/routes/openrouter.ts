import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getOpenRouterService } from '../services/openrouter';

const router = Router();

const MessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1, 'Conteúdo da mensagem é obrigatório')
});

const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1, 'Pelo menos uma mensagem é necessária'),
  model: z.string().optional(),
  max_tokens: z.number().optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  presence_penalty: z.number().min(-2).max(2).optional()
});

const QuestionRequestSchema = z.object({
  question: z.string().min(1, 'Pergunta é obrigatória'),
  systemPrompt: z.string().optional(),
  model: z.string().optional()
});

const LibraryAnalysisSchema = z.object({
  libraryData: z.any(),
  model: z.string().optional()
});

const AdSuggestionSchema = z.object({
  adData: z.any(),
  model: z.string().optional()
});

router.post('/chat', async (req: Request, res: Response) => {
  try {
    const data = ChatRequestSchema.parse(req.body);
    const svc = getOpenRouterService();
    const response = await svc.sendMessage(data.messages, {
      model: data.model,
      max_tokens: data.max_tokens,
      temperature: data.temperature,
      top_p: data.top_p,
      frequency_penalty: data.frequency_penalty,
      presence_penalty: data.presence_penalty
    });
    res.json({ success: true, data: response });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Erro interno do servidor' });
  }
});

router.post('/ask', async (req: Request, res: Response) => {
  try {
    const data = QuestionRequestSchema.parse(req.body);
    const answer = await getOpenRouterService().askQuestion(data.question, data.systemPrompt, data.model);
    res.json({ success: true, data: { answer } });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Erro interno do servidor' });
  }
});

router.post('/analyze-library', async (req: Request, res: Response) => {
  try {
    const data = LibraryAnalysisSchema.parse(req.body);
    const analysis = await getOpenRouterService().analyzeLibrary(data.libraryData);
    res.json({ success: true, data: { analysis } });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Erro interno do servidor' });
  }
});

router.post('/suggest-ads', async (req: Request, res: Response) => {
  try {
    const data = AdSuggestionSchema.parse(req.body);
    const suggestions = await getOpenRouterService().generateAdSuggestions(data.adData);
    res.json({ success: true, data: { suggestions } });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Erro interno do servidor' });
  }
});

router.get('/models', async (_req: Request, res: Response) => {
  try {
    const models = await getOpenRouterService().getAvailableModels();
    res.json({ success: true, data: models });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Erro interno do servidor' });
  }
});

router.get('/health', async (_req: Request, res: Response) => {
  try {
    const testResponse = await getOpenRouterService().askQuestion(
      'Olá, você está funcionando?',
      'Responda apenas "Sim, estou funcionando!"',
      'openai/gpt-4o-mini'
    );
    res.json({ success: true, data: { status: 'online', testResponse, timestamp: new Date().toISOString() } });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Erro interno do servidor' });
  }
});

export default router;
