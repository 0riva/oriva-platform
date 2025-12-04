import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';
import type { Logger } from 'winston';
import winston from 'winston';

// Types matching the iOS MerlinAIEndpoints.swift definitions
// Renamed from HugoAI to MerlinAI - 2025-12-03
export enum CognitiveDomain {
  DATING = 'dating',
  RELATIONSHIPS = 'relationships',
  COMMUNICATION = 'communication',
  EMOTIONAL_INTELLIGENCE = 'emotional_intelligence',
  SELF_AWARENESS = 'self_awareness',
  SOCIAL_DYNAMICS = 'social_dynamics',
  CAREER = 'career',
  HEALTH = 'health',
  CREATIVITY = 'creativity',
  GENERAL = 'general',
}

export enum ComplexityLevel {
  SIMPLE = 'simple',
  MODERATE = 'moderate',
  COMPLEX = 'complex',
}

export enum TimeConstraint {
  IMMEDIATE = 'immediate', // <100ms
  FAST = 'fast', // <500ms
  NORMAL = 'normal', // <2000ms
  DEEP = 'deep', // No constraint
}

export interface ChatRequest {
  sessionId: string;
  message: string;
  context: {
    domain: CognitiveDomain;
    recentMessages?: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
      timestamp: Date;
    }>;
    userProfile?: any;
    currentGoals?: string[];
  };
  localProcessingHint?: {
    complexity: ComplexityLevel;
    requiresDeepAnalysis: boolean;
    timeConstraint?: TimeConstraint;
  };
}

export interface ChatResponse {
  message: string;
  metadata: {
    processingTime: number;
    modelVersion: string;
    confidence: number;
    wasDeepAnalysis: boolean;
  };
  learningPoints?: Array<{
    concept: string;
    domain: CognitiveDomain;
    reinforcement?: string;
  }>;
  suggestedActions?: Array<{
    id: string;
    action: string;
    rationale: string;
    domain: CognitiveDomain;
  }>;
  localCacheHint?: {
    cacheKey?: string;
    cacheDuration?: number;
    cacheablePatterns?: string[];
  };
}

export interface LearningData {
  interaction: {
    sessionId: string;
    domain: CognitiveDomain;
    messages: Array<any>;
    userActions?: Array<any>;
    duration: number;
  };
  outcome?: {
    success: boolean;
    metrics?: Record<string, number>;
    qualitativeNotes?: string;
  };
  feedback?: {
    rating?: number;
    helpful?: boolean;
    comments?: string;
  };
  timestamp: Date;
}

export interface AnalysisRequest {
  context: {
    domain: CognitiveDomain;
    data: any;
    userId: string;
    sessionId?: string;
  };
  depth: 'surface' | 'standard' | 'deep' | 'comprehensive';
  returnInsights: boolean;
}

export interface InsightsResponse {
  insights: Array<{
    id: string;
    domain: CognitiveDomain;
    title: string;
    description: string;
    significance: 'low' | 'medium' | 'high' | 'critical';
    evidence?: string[];
    timestamp: Date;
  }>;
  recommendations: Array<{
    id: string;
    domain: CognitiveDomain;
    action: string;
    rationale: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    estimatedImpact: 'minimal' | 'moderate' | 'significant' | 'transformative';
  }>;
  progressSummary?: any;
}

export interface SyncRequest {
  userId: string;
  lastSyncTimestamp?: Date;
  localData?: {
    interactions?: LearningData[];
    preferences?: any;
    progress?: any[];
  };
  requestedData: Array<
    'insights' | 'recommendations' | 'modelUpdates' | 'preferences' | 'progress'
  >;
}

export interface SyncResponse {
  timestamp: Date;
  updates: {
    insights?: any[];
    recommendations?: any[];
    modelUpdates?: {
      version: string;
      improvements: string[];
      downloadURL?: string;
      size?: number;
      mandatory: boolean;
    };
    preferences?: any;
    progress?: any[];
  };
  nextSyncInterval?: number;
}

// MerlinAI Service Class
export class MerlinAIService {
  private logger: Logger;
  private openai: OpenAI;
  private supabase: SupabaseClient;
  private modelCache: Map<string, any> = new Map();

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;

    // Initialize OpenAI
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });

    // Setup logger
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
      defaultMeta: { service: 'merlin-ai' },
      transports: [new winston.transports.Console()],
    });
  }

  /**
   * Process chat messages with hybrid local/cloud routing logic
   */
  async processChat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();

    try {
      // Determine if we should use deep analysis based on hints
      const useDeepAnalysis = this.shouldUseDeepAnalysis(request);
      const model = useDeepAnalysis ? 'gpt-4-turbo-preview' : 'gpt-3.5-turbo';

      // Build conversation context
      const messages = this.buildConversationContext(request);

      // Get AI response
      const completion = await this.openai.chat.completions.create({
        model,
        messages,
        temperature: 0.7,
        max_tokens: useDeepAnalysis ? 2000 : 500,
        response_format: { type: 'json_object' },
      });

      const aiResponse = JSON.parse(completion.choices[0].message.content || '{}');

      // Process and structure response
      const response: ChatResponse = {
        message: aiResponse.message || 'I understand. Let me help you with that.',
        metadata: {
          processingTime: Date.now() - startTime,
          modelVersion: model,
          confidence: aiResponse.confidence || 0.85,
          wasDeepAnalysis: useDeepAnalysis,
        },
        learningPoints: aiResponse.learningPoints,
        suggestedActions: aiResponse.suggestedActions,
        localCacheHint: this.generateCacheHint(request, aiResponse),
      };

      // Store learning data asynchronously
      this.storeLearningData({
        interaction: {
          sessionId: request.sessionId,
          domain: request.context.domain,
          messages: [
            ...(request.context.recentMessages || []),
            { role: 'user', content: request.message, timestamp: new Date() },
            { role: 'assistant', content: response.message, timestamp: new Date() },
          ],
          duration: response.metadata.processingTime,
        },
        timestamp: new Date(),
      }).catch((err) => this.logger.error('Failed to store learning data', err));

      return response;
    } catch (error) {
      this.logger.error('Chat processing error', error);
      throw error;
    }
  }

  /**
   * Perform deep analysis on conversation or behavior patterns
   */
  async analyze(request: AnalysisRequest): Promise<any> {
    const startTime = Date.now();

    try {
      // Use more sophisticated model for analysis
      const model = 'gpt-4-turbo-preview';

      const systemPrompt = this.buildAnalysisPrompt(request);

      const completion = await this.openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(request.context.data) },
        ],
        temperature: 0.3,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      });

      const analysis = JSON.parse(completion.choices[0].message.content || '{}');

      // Store analysis results
      await this.storeAnalysisResults(request.context.userId, analysis);

      return {
        ...analysis,
        metadata: {
          processingTime: Date.now() - startTime,
          analysisDepth: request.depth,
          domain: request.context.domain,
        },
      };
    } catch (error) {
      this.logger.error('Analysis error', error);
      throw error;
    }
  }

  /**
   * Store learning data for MerlinAI evolution
   */
  async storeLearningData(data: LearningData): Promise<void> {
    try {
      const { error } = await this.supabase.from('merlin_ai.learning_data').insert({
        session_id: data.interaction.sessionId,
        domain: data.interaction.domain,
        interaction_data: data.interaction,
        outcome_data: data.outcome,
        feedback_data: data.feedback,
        created_at: data.timestamp,
      });

      if (error) {
        this.logger.error('Failed to store learning data', error);
      }
    } catch (error) {
      this.logger.error('Learning data storage error', error);
    }
  }

  /**
   * Get personalized insights for a user
   */
  async getInsights(userId: string, domain?: CognitiveDomain): Promise<InsightsResponse> {
    try {
      // Fetch user's historical data
      const { data: userData } = await this.supabase
        .from('merlin_ai.user_insights')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      // Analyze patterns and generate insights
      const insights = await this.generateInsights(userData || [], domain);

      return insights;
    } catch (error) {
      this.logger.error('Insights generation error', error);
      throw error;
    }
  }

  /**
   * Sync data between local and cloud
   */
  async sync(request: SyncRequest): Promise<SyncResponse> {
    const timestamp = new Date();

    try {
      // Process incoming local data
      if (request.localData?.interactions) {
        await Promise.all(
          request.localData.interactions.map((data) => this.storeLearningData(data))
        );
      }

      // Gather requested data
      const updates: SyncResponse['updates'] = {};

      if (request.requestedData.includes('insights')) {
        const insights = await this.getInsights(request.userId);
        updates.insights = insights.insights;
      }

      if (request.requestedData.includes('modelUpdates')) {
        updates.modelUpdates = await this.checkModelUpdates();
      }

      if (request.requestedData.includes('progress')) {
        updates.progress = await this.getUserProgress(request.userId);
      }

      return {
        timestamp,
        updates,
        nextSyncInterval: 3600, // 1 hour in seconds
      };
    } catch (error) {
      this.logger.error('Sync error', error);
      throw error;
    }
  }

  // Private helper methods

  private shouldUseDeepAnalysis(request: ChatRequest): boolean {
    // Use deep analysis if explicitly requested
    if (request.localProcessingHint?.requiresDeepAnalysis) {
      return true;
    }

    // Use deep analysis for complex queries
    if (request.localProcessingHint?.complexity === ComplexityLevel.COMPLEX) {
      return true;
    }

    // Use deep analysis for certain domains
    if (
      [CognitiveDomain.RELATIONSHIPS, CognitiveDomain.EMOTIONAL_INTELLIGENCE].includes(
        request.context.domain
      )
    ) {
      return true;
    }

    // Check time constraints
    if (request.localProcessingHint?.timeConstraint === TimeConstraint.IMMEDIATE) {
      return false;
    }

    return false;
  }

  private buildConversationContext(request: ChatRequest): any[] {
    const systemPrompt = this.getSystemPrompt(request.context.domain);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(request.context.recentMessages || []).map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: 'user', content: request.message },
    ];

    return messages;
  }

  private getSystemPrompt(domain: CognitiveDomain): string {
    const prompts: Record<CognitiveDomain, string> = {
      [CognitiveDomain.DATING]: `You are Merlin, an AI dating coach helping users practice conversations and learn "The Intimacy Code" methodology. Focus on building confidence, authentic connection, and emotional intelligence. Always respond in JSON format with keys: message, confidence, learningPoints, suggestedActions.`,

      [CognitiveDomain.RELATIONSHIPS]: `You are Merlin, an AI relationship coach specializing in deepening connections and resolving conflicts. Apply "The Intimacy Code" principles. Always respond in JSON format with keys: message, confidence, learningPoints, suggestedActions.`,

      [CognitiveDomain.COMMUNICATION]: `You are Merlin, an AI communication coach helping users express themselves clearly and listen actively. Always respond in JSON format with keys: message, confidence, learningPoints, suggestedActions.`,

      [CognitiveDomain.EMOTIONAL_INTELLIGENCE]: `You are Merlin, an AI coach for emotional intelligence helping users understand and manage emotions effectively. Focus on self-awareness, empathy, and emotional regulation. Always respond in JSON format with keys: message, confidence, learningPoints, suggestedActions.`,

      [CognitiveDomain.SELF_AWARENESS]: `You are Merlin, an AI coach for self-awareness helping users understand their patterns, values, and authentic self. Focus on introspection and personal growth. Always respond in JSON format with keys: message, confidence, learningPoints, suggestedActions.`,

      [CognitiveDomain.SOCIAL_DYNAMICS]: `You are Merlin, an AI coach for social dynamics helping users navigate social situations with confidence and authenticity. Focus on social skills and group dynamics. Always respond in JSON format with keys: message, confidence, learningPoints, suggestedActions.`,

      [CognitiveDomain.CAREER]: `You are Merlin, an AI career coach helping users navigate professional growth and career transitions. Focus on skills development and strategic planning. Always respond in JSON format with keys: message, confidence, learningPoints, suggestedActions.`,

      [CognitiveDomain.HEALTH]: `You are Merlin, an AI health and wellness coach helping users develop sustainable healthy habits and lifestyle choices. Focus on holistic wellbeing. Always respond in JSON format with keys: message, confidence, learningPoints, suggestedActions.`,

      [CognitiveDomain.CREATIVITY]: `You are Merlin, an AI creativity coach helping users unlock their creative potential and overcome creative blocks. Focus on innovation and artistic expression. Always respond in JSON format with keys: message, confidence, learningPoints, suggestedActions.`,
      [CognitiveDomain.GENERAL]: `You are Merlin, an AI coach for human cognitive evolution across all life areas. Always respond in JSON format with keys: message, confidence, learningPoints, suggestedActions.`,
    };

    return prompts[domain] || prompts[CognitiveDomain.GENERAL];
  }

  private buildAnalysisPrompt(request: AnalysisRequest): string {
    return `Analyze the provided ${request.context.domain} data with ${request.depth} depth.
    Focus on patterns, insights, and actionable recommendations.
    Return a JSON object with keys: patterns, insights, recommendations, summary.`;
  }

  private generateCacheHint(request: ChatRequest, response: any): any {
    // Simple responses can be cached longer
    if (request.localProcessingHint?.complexity === ComplexityLevel.SIMPLE) {
      return {
        cacheKey: `${request.context.domain}_${request.message.toLowerCase().replace(/\s+/g, '_')}`,
        cacheDuration: 3600, // 1 hour
        cacheablePatterns: ['greeting', 'basic_question'],
      };
    }

    return undefined;
  }

  private async storeAnalysisResults(userId: string, analysis: any): Promise<void> {
    await this.supabase.from('merlin_ai.analysis_results').insert({
      user_id: userId,
      analysis_data: analysis,
      created_at: new Date(),
    });
  }

  private async generateInsights(
    userData: any[],
    domain?: CognitiveDomain
  ): Promise<InsightsResponse> {
    // Process user data to generate insights
    // This would involve pattern recognition and AI analysis

    return {
      insights: [],
      recommendations: [],
      progressSummary: undefined,
    };
  }

  private async checkModelUpdates(): Promise<any> {
    // Check for available model updates
    return {
      version: '1.0.0',
      improvements: ['Enhanced dating conversation patterns', 'Better emotional intelligence'],
      mandatory: false,
    };
  }

  private async getUserProgress(userId: string): Promise<any[]> {
    const { data } = await this.supabase
      .from('merlin_ai.user_progress')
      .select('*')
      .eq('user_id', userId);

    return data || [];
  }
}

// Export singleton instance
let merlinAIServiceInstance: MerlinAIService | null = null;

export const getMerlinAIService = (supabase: SupabaseClient): MerlinAIService => {
  if (!merlinAIServiceInstance) {
    merlinAIServiceInstance = new MerlinAIService(supabase);
  }
  return merlinAIServiceInstance;
};

// Backward compatibility exports (deprecated)
/** @deprecated Use MerlinAIService instead */
export const HugoAIService = MerlinAIService;
/** @deprecated Use getMerlinAIService instead */
export const getHugoAIService = getMerlinAIService;
