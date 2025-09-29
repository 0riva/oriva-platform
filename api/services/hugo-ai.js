"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHugoAIService = exports.HugoAIService = exports.TimeConstraint = exports.ComplexityLevel = exports.CognitiveDomain = void 0;
const openai_1 = require("openai");
const winston_1 = __importDefault(require("winston"));
// Types matching the iOS HugoAIEndpoints.swift definitions
var CognitiveDomain;
(function (CognitiveDomain) {
    CognitiveDomain["DATING"] = "dating";
    CognitiveDomain["RELATIONSHIPS"] = "relationships";
    CognitiveDomain["COMMUNICATION"] = "communication";
    CognitiveDomain["EMOTIONAL_INTELLIGENCE"] = "emotional_intelligence";
    CognitiveDomain["SELF_AWARENESS"] = "self_awareness";
    CognitiveDomain["SOCIAL_DYNAMICS"] = "social_dynamics";
    CognitiveDomain["CAREER"] = "career";
    CognitiveDomain["HEALTH"] = "health";
    CognitiveDomain["CREATIVITY"] = "creativity";
    CognitiveDomain["GENERAL"] = "general";
})(CognitiveDomain || (exports.CognitiveDomain = CognitiveDomain = {}));
var ComplexityLevel;
(function (ComplexityLevel) {
    ComplexityLevel["SIMPLE"] = "simple";
    ComplexityLevel["MODERATE"] = "moderate";
    ComplexityLevel["COMPLEX"] = "complex";
})(ComplexityLevel || (exports.ComplexityLevel = ComplexityLevel = {}));
var TimeConstraint;
(function (TimeConstraint) {
    TimeConstraint["IMMEDIATE"] = "immediate";
    TimeConstraint["FAST"] = "fast";
    TimeConstraint["NORMAL"] = "normal";
    TimeConstraint["DEEP"] = "deep"; // No constraint
})(TimeConstraint || (exports.TimeConstraint = TimeConstraint = {}));
// HugoAI Service Class
class HugoAIService {
    constructor(supabaseClient) {
        this.modelCache = new Map();
        this.supabase = supabaseClient;
        // Initialize OpenAI
        this.openai = new openai_1.OpenAI({
            apiKey: process.env.OPENAI_API_KEY || ''
        });
        // Setup logger
        this.logger = winston_1.default.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
            defaultMeta: { service: 'hugo-ai' },
            transports: [new winston_1.default.transports.Console()]
        });
    }
    /**
     * Process chat messages with hybrid local/cloud routing logic
     */
    async processChat(request) {
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
                response_format: { type: "json_object" }
            });
            const aiResponse = JSON.parse(completion.choices[0].message.content || '{}');
            // Process and structure response
            const response = {
                message: aiResponse.message || 'I understand. Let me help you with that.',
                metadata: {
                    processingTime: Date.now() - startTime,
                    modelVersion: model,
                    confidence: aiResponse.confidence || 0.85,
                    wasDeepAnalysis: useDeepAnalysis
                },
                learningPoints: aiResponse.learningPoints,
                suggestedActions: aiResponse.suggestedActions,
                localCacheHint: this.generateCacheHint(request, aiResponse)
            };
            // Store learning data asynchronously
            this.storeLearningData({
                interaction: {
                    sessionId: request.sessionId,
                    domain: request.context.domain,
                    messages: [...(request.context.recentMessages || []),
                        { role: 'user', content: request.message, timestamp: new Date() },
                        { role: 'assistant', content: response.message, timestamp: new Date() }
                    ],
                    duration: response.metadata.processingTime
                },
                timestamp: new Date()
            }).catch(err => this.logger.error('Failed to store learning data', err));
            return response;
        }
        catch (error) {
            this.logger.error('Chat processing error', error);
            throw error;
        }
    }
    /**
     * Perform deep analysis on conversation or behavior patterns
     */
    async analyze(request) {
        const startTime = Date.now();
        try {
            // Use more sophisticated model for analysis
            const model = 'gpt-4-turbo-preview';
            const systemPrompt = this.buildAnalysisPrompt(request);
            const completion = await this.openai.chat.completions.create({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: JSON.stringify(request.context.data) }
                ],
                temperature: 0.3,
                max_tokens: 3000,
                response_format: { type: "json_object" }
            });
            const analysis = JSON.parse(completion.choices[0].message.content || '{}');
            // Store analysis results
            await this.storeAnalysisResults(request.context.userId, analysis);
            return {
                ...analysis,
                metadata: {
                    processingTime: Date.now() - startTime,
                    analysisDepth: request.depth,
                    domain: request.context.domain
                }
            };
        }
        catch (error) {
            this.logger.error('Analysis error', error);
            throw error;
        }
    }
    /**
     * Store learning data for HugoAI evolution
     */
    async storeLearningData(data) {
        try {
            const { error } = await this.supabase
                .from('hugo_learning_data')
                .insert({
                session_id: data.interaction.sessionId,
                domain: data.interaction.domain,
                interaction_data: data.interaction,
                outcome_data: data.outcome,
                feedback_data: data.feedback,
                created_at: data.timestamp
            });
            if (error) {
                this.logger.error('Failed to store learning data', error);
            }
        }
        catch (error) {
            this.logger.error('Learning data storage error', error);
        }
    }
    /**
     * Get personalized insights for a user
     */
    async getInsights(userId, domain) {
        try {
            // Fetch user's historical data
            const { data: userData } = await this.supabase
                .from('hugo_user_insights')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(100);
            // Analyze patterns and generate insights
            const insights = await this.generateInsights(userData || [], domain);
            return insights;
        }
        catch (error) {
            this.logger.error('Insights generation error', error);
            throw error;
        }
    }
    /**
     * Sync data between local and cloud
     */
    async sync(request) {
        const timestamp = new Date();
        try {
            // Process incoming local data
            if (request.localData?.interactions) {
                await Promise.all(request.localData.interactions.map(data => this.storeLearningData(data)));
            }
            // Gather requested data
            const updates = {};
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
                nextSyncInterval: 3600 // 1 hour in seconds
            };
        }
        catch (error) {
            this.logger.error('Sync error', error);
            throw error;
        }
    }
    // Private helper methods
    shouldUseDeepAnalysis(request) {
        // Use deep analysis if explicitly requested
        if (request.localProcessingHint?.requiresDeepAnalysis) {
            return true;
        }
        // Use deep analysis for complex queries
        if (request.localProcessingHint?.complexity === ComplexityLevel.COMPLEX) {
            return true;
        }
        // Use deep analysis for certain domains
        if ([CognitiveDomain.RELATIONSHIPS, CognitiveDomain.EMOTIONAL_INTELLIGENCE].includes(request.context.domain)) {
            return true;
        }
        // Check time constraints
        if (request.localProcessingHint?.timeConstraint === TimeConstraint.IMMEDIATE) {
            return false;
        }
        return false;
    }
    buildConversationContext(request) {
        const systemPrompt = this.getSystemPrompt(request.context.domain);
        const messages = [
            { role: 'system', content: systemPrompt },
            ...(request.context.recentMessages || []).map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            { role: 'user', content: request.message }
        ];
        return messages;
    }
    getSystemPrompt(domain) {
        const prompts = {
            [CognitiveDomain.DATING]: `You are Hugo, an AI dating coach helping users practice conversations and learn "The Intimacy Code" methodology. Focus on building confidence, authentic connection, and emotional intelligence. Always respond in JSON format with keys: message, confidence, learningPoints, suggestedActions.`,
            [CognitiveDomain.RELATIONSHIPS]: `You are Hugo, an AI relationship coach specializing in deepening connections and resolving conflicts. Apply "The Intimacy Code" principles. Always respond in JSON format with keys: message, confidence, learningPoints, suggestedActions.`,
            [CognitiveDomain.COMMUNICATION]: `You are Hugo, an AI communication coach helping users express themselves clearly and listen actively. Always respond in JSON format with keys: message, confidence, learningPoints, suggestedActions.`,
            [CognitiveDomain.EMOTIONAL_INTELLIGENCE]: `You are Hugo, an AI coach for emotional intelligence helping users understand and manage emotions effectively. Focus on self-awareness, empathy, and emotional regulation. Always respond in JSON format with keys: message, confidence, learningPoints, suggestedActions.`,
            [CognitiveDomain.SELF_AWARENESS]: `You are Hugo, an AI coach for self-awareness helping users understand their patterns, values, and authentic self. Focus on introspection and personal growth. Always respond in JSON format with keys: message, confidence, learningPoints, suggestedActions.`,
            [CognitiveDomain.SOCIAL_DYNAMICS]: `You are Hugo, an AI coach for social dynamics helping users navigate social situations with confidence and authenticity. Focus on social skills and group dynamics. Always respond in JSON format with keys: message, confidence, learningPoints, suggestedActions.`,
            [CognitiveDomain.CAREER]: `You are Hugo, an AI career coach helping users navigate professional growth and career transitions. Focus on skills development and strategic planning. Always respond in JSON format with keys: message, confidence, learningPoints, suggestedActions.`,
            [CognitiveDomain.HEALTH]: `You are Hugo, an AI health and wellness coach helping users develop sustainable healthy habits and lifestyle choices. Focus on holistic wellbeing. Always respond in JSON format with keys: message, confidence, learningPoints, suggestedActions.`,
            [CognitiveDomain.CREATIVITY]: `You are Hugo, an AI creativity coach helping users unlock their creative potential and overcome creative blocks. Focus on innovation and artistic expression. Always respond in JSON format with keys: message, confidence, learningPoints, suggestedActions.`,
            [CognitiveDomain.GENERAL]: `You are Hugo, an AI coach for human cognitive evolution across all life areas. Always respond in JSON format with keys: message, confidence, learningPoints, suggestedActions.`
        };
        return prompts[domain] || prompts[CognitiveDomain.GENERAL];
    }
    buildAnalysisPrompt(request) {
        return `Analyze the provided ${request.context.domain} data with ${request.depth} depth.
    Focus on patterns, insights, and actionable recommendations.
    Return a JSON object with keys: patterns, insights, recommendations, summary.`;
    }
    generateCacheHint(request, response) {
        // Simple responses can be cached longer
        if (request.localProcessingHint?.complexity === ComplexityLevel.SIMPLE) {
            return {
                cacheKey: `${request.context.domain}_${request.message.toLowerCase().replace(/\s+/g, '_')}`,
                cacheDuration: 3600, // 1 hour
                cacheablePatterns: ['greeting', 'basic_question']
            };
        }
        return undefined;
    }
    async storeAnalysisResults(userId, analysis) {
        await this.supabase
            .from('hugo_analysis_results')
            .insert({
            user_id: userId,
            analysis_data: analysis,
            created_at: new Date()
        });
    }
    async generateInsights(userData, domain) {
        // Process user data to generate insights
        // This would involve pattern recognition and AI analysis
        return {
            insights: [],
            recommendations: [],
            progressSummary: undefined
        };
    }
    async checkModelUpdates() {
        // Check for available model updates
        return {
            version: '1.0.0',
            improvements: ['Enhanced dating conversation patterns', 'Better emotional intelligence'],
            mandatory: false
        };
    }
    async getUserProgress(userId) {
        const { data } = await this.supabase
            .from('hugo_user_progress')
            .select('*')
            .eq('user_id', userId);
        return data || [];
    }
}
exports.HugoAIService = HugoAIService;
// Export singleton instance
let hugoAIServiceInstance = null;
const getHugoAIService = (supabase) => {
    if (!hugoAIServiceInstance) {
        hugoAIServiceInstance = new HugoAIService(supabase);
    }
    return hugoAIServiceInstance;
};
exports.getHugoAIService = getHugoAIService;
