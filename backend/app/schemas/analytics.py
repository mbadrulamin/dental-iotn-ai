"""
Analytics and metrics Pydantic schemas.
"""

from datetime import datetime
from typing import Optional, Dict, List
from uuid import UUID

from pydantic import BaseModel, Field


class ConfusionMatrix(BaseModel):
    """Confusion matrix for binary classification."""
    true_positive: int = Field(..., alias="tp")
    true_negative: int = Field(..., alias="tn")
    false_positive: int = Field(..., alias="fp")
    false_negative: int = Field(..., alias="fn")
    
    model_config = {"populate_by_name": True}


class PerformanceMetrics(BaseModel):
    """Performance metrics for a single condition."""
    condition: str
    confusion_matrix: ConfusionMatrix
    sensitivity: float = Field(..., ge=0, le=1, description="True Positive Rate")
    specificity: float = Field(..., ge=0, le=1, description="True Negative Rate")
    accuracy: float = Field(..., ge=0, le=1)
    precision: float = Field(..., ge=0, le=1)
    f1_score: float = Field(..., ge=0, le=1)
    total_samples: int


class KappaResult(BaseModel):
    """Cohen's Kappa result."""
    condition: str
    kappa: float = Field(..., ge=-1, le=1)
    interpretation: str  # e.g., "Substantial Agreement"
    observed_agreement: float
    expected_agreement: float


class OverallMetrics(BaseModel):
    """Overall performance metrics across all conditions."""
    conditions: List[PerformanceMetrics]
    kappa_results: List[KappaResult]
    total_images: int
    total_experts: int
    generated_at: datetime


class SUSInput(BaseModel):
    """Schema for SUS questionnaire input."""
    q1_score: int = Field(..., ge=1, le=5)
    q2_score: int = Field(..., ge=1, le=5)
    q3_score: int = Field(..., ge=1, le=5)
    q4_score: int = Field(..., ge=1, le=5)
    q5_score: int = Field(..., ge=1, le=5)
    q6_score: int = Field(..., ge=1, le=5)
    q7_score: int = Field(..., ge=1, le=5)
    q8_score: int = Field(..., ge=1, le=5)
    q9_score: int = Field(..., ge=1, le=5)
    q10_score: int = Field(..., ge=1, le=5)


class SUSResult(BaseModel):
    """Schema for SUS result."""
    id: UUID
    user_id: UUID
    scores: Dict[str, int]
    total_sus_score: float = Field(..., ge=0, le=100)
    grade: str  # A, B, C, D, F
    percentile_rank: Optional[float] = None
    submitted_at: datetime
    
    model_config = {"from_attributes": True}


class SUSStatistics(BaseModel):
    """Aggregate SUS statistics."""
    total_responses: int
    mean_score: float
    median_score: float
    std_deviation: float
    min_score: float
    max_score: float
    grade_distribution: Dict[str, int]
