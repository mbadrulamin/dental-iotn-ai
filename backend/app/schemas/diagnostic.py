"""
Diagnostic-related Pydantic schemas.
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID
from enum import Enum

from pydantic import BaseModel, Field


class ImageType(str, Enum):
    """Type of dental image."""
    FRONTAL = "frontal"
    LATERAL = "lateral"
    OCCLUSAL = "occlusal"


class MeasurementInput(BaseModel):
    """Schema for clinical measurement input from user."""
    overjet_mm: Optional[float] = Field(None, ge=0, description="Overjet in mm")
    reverse_overjet_mm: Optional[float] = Field(None, ge=0, description="Reverse overjet in mm")
    overbite_mm: Optional[float] = Field(None, ge=0, description="Overbite in mm")
    displacement_mm: Optional[float] = Field(None, ge=0, description="Displacement in mm")
    crossbite_displacement_mm: Optional[float] = Field(None, ge=0, description="Crossbite displacement in mm")
    open_bite_mm: Optional[float] = Field(None, ge=0, description="Open bite in mm")
    
    # Additional clinical indicators
    lips_competent: Optional[bool] = Field(None, description="Are lips competent at rest?")
    gingival_contact: Optional[bool] = Field(None, description="Is there gingival contact?")
    gingival_trauma: Optional[bool] = Field(None, description="Is there gingival trauma/indentation?")
    speech_difficulty: Optional[bool] = Field(None, description="Speech difficulties reported?")
    masticatory_difficulty: Optional[bool] = Field(None, description="Masticatory difficulties reported?")


class DiagnosticRequest(BaseModel):
    """Schema for diagnostic request."""
    image_type: Optional[ImageType] = None
    measurements: MeasurementInput


class InferenceResult(BaseModel):
    """Schema for individual model inference result."""
    model_name: str
    detected: bool
    confidence: float = Field(..., ge=0, le=1)
    
    
class SegmentationResult(BaseModel):
    """Schema for segmentation model result."""
    mask_url: Optional[str] = None
    tooth_count: Optional[int] = None
    

class IOTNResult(BaseModel):
    """Schema for IOTN grade calculation result."""
    grade: int = Field(..., ge=1, le=5)
    grade_description: str
    determining_factor: str
    treatment_need: str


class DiagnosticResponse(BaseModel):
    """Schema for complete diagnostic response."""
    id: UUID
    image_url: str
    image_type: Optional[ImageType]
    
    # Classification results
    classifications: List[InferenceResult]
    
    # Segmentation result (for occlusal images)
    segmentation: Optional[SegmentationResult] = None
    
    # IOTN result
    iotn: IOTNResult
    
    # Measurement input echo
    measurements: MeasurementInput
    
    processed_at: datetime
    
    model_config = {"from_attributes": True}
