/**
 * API client for communicating with the backend.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
    Token,
    User,
    LoginCredentials,
    RegisterData,
    DiagnosticResponse,
    MeasurementInput,
    AssessmentCreate,
    AssessmentResponse,
    ImageForReview,
    Dataset,
    PerformanceMetrics,
    KappaResult,
    SUSInput,
    SUSResult,
    ReviewProgress,
} from '@/types';

// const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const API_URL = process.env.NEXT_PUBLIC_API_URL || "" //empty string for automatic relative path (Nginx will catch)

class ApiClient {
    private client: AxiosInstance;
    private accessToken: string | null = null;

    constructor() {
        this.client = axios.create({
            baseURL: API_URL,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Request interceptor to add auth token
        this.client.interceptors.request.use((config) => {
            if (this.accessToken) {
                config.headers.Authorization = `Bearer ${this.accessToken}`;
            }
            return config;
        });

        // Response interceptor for error handling
        this.client.interceptors.response.use(
            (response) => response,
            (error: AxiosError) => {
                if (error.response?.status === 401) {
                    this.accessToken = null;
                    if (typeof window !== 'undefined') {
                        localStorage.removeItem('access_token');
                        localStorage.removeItem('refresh_token');
                    }
                }
                return Promise.reject(error);
            }
        );

        // Load token from localStorage on init
        if (typeof window !== 'undefined') {
            this.accessToken = localStorage.getItem('access_token');
        }
    }

    setToken(token: string | null) {
        this.accessToken = token;
        if (typeof window !== 'undefined') {
            if (token) {
                localStorage.setItem('access_token', token);
            } else {
                localStorage.removeItem('access_token');
            }
        }
    }

    // Auth endpoints
    async register(data: RegisterData): Promise<User> {
        const response = await this.client.post('/api/auth/register', data);
        return response.data;
    }

    async login(credentials: LoginCredentials): Promise<Token> {
        const response = await this.client.post('/api/auth/login', credentials);
        const token = response.data as Token;
        this.setToken(token.access_token);
        if (typeof window !== 'undefined') {
            localStorage.setItem('refresh_token', token.refresh_token);
        }
        return token;
    }

    async getMe(): Promise<User> {
        const response = await this.client.get('/api/auth/me');
        return response.data;
    }

    logout() {
        this.setToken(null);
        if (typeof window !== 'undefined') {
            localStorage.removeItem('refresh_token');
        }
    }

    // Diagnostic endpoints
    async analyzeDiagnostic(
        file: File,
        imageType: string | null,
        measurements: MeasurementInput
    ): Promise<DiagnosticResponse> {
        const formData = new FormData();
        formData.append('file', file);

        if (imageType) {
            formData.append('image_type', imageType);
        }

        // Add measurements to form data
        Object.entries(measurements).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
                formData.append(key, String(value));
            }
        });

        const response = await this.client.post('/api/diagnostic/analyze', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    }

    async getResult(imageId: string): Promise<DiagnosticResponse> {
        const response = await this.client.get(`/api/diagnostic/result/${imageId}`);
        return response.data;
    }

    // Validation endpoints
    async getNextImage(datasetId?: string): Promise<ImageForReview | null> {
        const params = datasetId ? { dataset_id: datasetId } : {};
        const response = await this.client.get('/api/validation/next', { params });
        return response.data;
    }

    async getReviewQueue(datasetId?: string, limit = 20): Promise<ImageForReview[]> {
        const params: Record<string, any> = { limit };
        if (datasetId) params.dataset_id = datasetId;
        const response = await this.client.get('/api/validation/queue', { params });
        return response.data;
    }

    async submitAssessment(assessment: AssessmentCreate): Promise<AssessmentResponse> {
        const response = await this.client.post('/api/validation/assess', assessment);
        return response.data;
    }

    async getMyAssessments(limit = 50): Promise<AssessmentResponse[]> {
        const response = await this.client.get('/api/validation/my-assessments', {
            params: { limit },
        });
        return response.data;
    }

    async getReviewProgress(datasetId?: string): Promise<ReviewProgress> {
        const params = datasetId ? { dataset_id: datasetId } : {};
        const response = await this.client.get('/api/validation/progress', { params });
        return response.data;
    }

    async getDatasetOverview(datasetId: string): Promise<any[]> {
        const response = await this.client.get(`/api/validation/dataset/${datasetId}/overview`);
        return response.data;
    }

    async getMyDatasets(): Promise<any[]> {
        const response = await this.client.get('/api/validation/my-datasets');
        return response.data;
    }

    // Admin endpoints
    async createDataset(name: string, description?: string, expertIds?: string[]): Promise<Dataset> {
        const response = await this.client.post('/api/admin/datasets', {
            name,
            description,
            expert_ids: expertIds || [],
            is_validation_set: true,
        });
        return response.data;
    }

    async updateDatasetExperts(datasetId: string, expertIds: string[]): Promise<any> {
        const response = await this.client.put(`/api/admin/datasets/${datasetId}/experts`, {
            expert_ids: expertIds
        });
        return response.data;
    }

    async getDatasets(): Promise<Dataset[]> {
        const response = await this.client.get('/api/admin/datasets');
        return response.data;
    }

    async uploadImages(datasetId: string, files: FileList, imageType?: string): Promise<any> {
        const formData = new FormData();
        Array.from(files).forEach((file) => formData.append('files', file));
        if (imageType) formData.append('image_type', imageType);

        const response = await this.client.post(
            `/api/admin/datasets/${datasetId}/images`,
            formData,
            { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        return response.data;
    }

    // Analytics endpoints
    async getPerformanceMetrics(datasetId?: string): Promise<PerformanceMetrics[]> {
        const params = datasetId ? { dataset_id: datasetId } : {};
        const response = await this.client.get('/api/analytics/performance', { params });
        return response.data;
    }

    async getKappaResults(datasetId?: string): Promise<KappaResult[]> {
        const params = datasetId ? { dataset_id: datasetId } : {};
        const response = await this.client.get('/api/analytics/kappa', { params });
        return response.data;
    }

    async submitSUS(input: SUSInput): Promise<SUSResult> {
        const response = await this.client.post('/api/analytics/sus', input);
        return response.data;
    }

    async downloadValidationCSV(datasetId?: string): Promise<Blob> {
        const params = datasetId ? { dataset_id: datasetId } : {};
        const response = await this.client.get('/api/analytics/export/validation-csv', {
            params,
            responseType: 'blob',
        });
        return response.data;
    }

    async downloadSUSCSV(): Promise<Blob> {
        const response = await this.client.get('/api/analytics/export/sus-csv', {
            responseType: 'blob',
        });
        return response.data;
    }

    // SUS Management
    async getSUSQuestions(): Promise<Record<string, string>> {
        const response = await this.client.get('/api/admin/settings/sus');
        return response.data;
    }

    async updateSUSQuestions(questions: Record<string, string>): Promise<any> {
        const response = await this.client.put('/api/admin/settings/sus', questions);
        return response.data;
    }
}

export const api = new ApiClient();
