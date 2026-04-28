export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface AIService {
    name: string;
    chat: (messages: ChatMessage[]) => AsyncGenerator<string>;
}

export interface EstimacionObraRequest {
    nombre_obra: string;
    superficie_m2: number;
    provincia_id?: number | null;
    estimacion_heuristica: {
        total_estimado: number;
        desglose_por_rubro: Record<string, number>;
        margen_error_pct: number;
    };
}

export interface EstimacionObraResponse {
    sugerencia_narrativa: string;
    ajuste_recomendado_pct: number | null;
    alertas: string[];
}