/**
 * Type definitions for the Dental IOTN AI Platform.
 */

// User & Auth Types
export interface User {
    id: string;
    email: string;
    full_name: string | null;
    role: 'admin' | 'expert' | 'guest';
    is_active: boolean;
    created_at: string;
}

export interface Token {
    access_token: string;
    refresh_token: string;
    token_type: string;
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegisterData {
    email: string;
    password: string;
    full_name?: string;
    role?: 'admin' | 'expert' | 'guest';
}

// Diagnostic Types
export interface MeasurementInput {
    overjet_mm?: number | null;
    reverse_overjet_mm?: number | null;
    overbite_mm?: number | null;
    displacement_mm?: number | null;
    crossbite_displacement_mm?: number | null;
    open_bite_mm?: number | null;
    lips_competent?: boolean | null;
    gingival_contact?: boolean | null;
    gingival_trauma?: boolean | null;
    speech_difficulty?: boolean | null;
    masticatory_difficulty?: boolean | null;
}

export interface InferenceResult {
    model_name: string;
    detected: boolean;
    confidence: number;
}

export interface SegmentationResult {
    mask_url: string | null;
    tooth_count: number | null;
}

export interface IOTNResult {
    grade: number;
    grade_description: string;
    determining_factor: string;
    treatment_need: string;
}

export interface DiagnosticResponse {
    id: string;
    image_url: string;
    image_type: 'frontal' | 'lateral' | 'occlusal' | null;
    classifications: InferenceResult[];
    segmentation: SegmentationResult | null;
    iotn: IOTNResult;
    measurements: MeasurementInput;
    processed_at: string;
}

// Assessment Types
export type AssessmentValue = 'yes' | 'no' | 'na';

export interface AssessmentCreate {
    image_id: string;
    crossbite_present: AssessmentValue;
    overbite_present: AssessmentValue;
    openbite_present: AssessmentValue;
    displacement_present: AssessmentValue;
    overjet_present: AssessmentValue;
    notes?: string;
}

export interface AssessmentResponse {
    id: string;
    image_id: string;
    expert_id: string;
    crossbite_present: AssessmentValue;
    overbite_present: AssessmentValue;
    openbite_present: AssessmentValue;
    displacement_present: AssessmentValue;
    overjet_present: AssessmentValue;
    notes: string | null;
    is_blind_review: boolean;
    assessed_at: string;
}

export interface ImageForReview {
    id: string;
    image_url: string;
    image_type: string | null;
    dataset_name: string | null;
}

// Dataset Types
export interface Dataset {
    id: string;
    name: string;
    description: string | null;
    is_validation_set: boolean;
    image_count: number;
}

// Analytics Types
export interface ConfusionMatrix {
    tp: number;
    tn: number;
    fp: number;
    fn: number;
}

export interface PerformanceMetrics {
    condition: string;
    confusion_matrix: ConfusionMatrix;
    sensitivity: number;
    specificity: number;
    accuracy: number;
    precision: number;
    f1_score: number;
    total_samples: number;
}

export interface KappaResult {
    condition: string;
    kappa: number;
    interpretation: string;
    observed_agreement: number;
    expected_agreement: number;
}

export interface SUSInput {
    q1_score: number;
    q2_score: number;
    q3_score: number;
    q4_score: number;
    q5_score: number;
    q6_score: number;
    q7_score: number;
    q8_score: number;
    q9_score: number;
    q10_score: number;
}

export interface SUSResult {
    id: string;
    user_id: string;
    scores: Record<string, number>;
    total_sus_score: number;
    grade: string;
    submitted_at: string;
}

export interface ReviewProgress {
    total_images: number;
    reviewed: number;
    remaining: number;
    progress_percent: number;
}
