"""
Expert assessment Pydantic schemas.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID
from enum import Enum

from pydantic import BaseModel


class AssessmentValue(str, Enum):
    """Assessment value options."""
    YES = "yes"
    NO = "no"
    NA = "na"


class AssessmentCreate(BaseModel):
    """Schema for creating an expert assessment."""
    image_id: UUID
    crossbite_present: AssessmentValue = AssessmentValue.NO
    overbite_present: AssessmentValue = AssessmentValue.NO
    openbite_present: AssessmentValue = AssessmentValue.NO
    displacement_present: AssessmentValue = AssessmentValue.NO
    overjet_present: AssessmentValue = AssessmentValue.NO
    notes: Optional[str] = None


class AssessmentResponse(BaseModel):
    """Schema for assessment response."""
    id: UUID
    image_id: UUID
    expert_id: UUID
    crossbite_present: AssessmentValue
    overbite_present: AssessmentValue
    openbite_present: AssessmentValue
    displacement_present: AssessmentValue
    overjet_present: AssessmentValue
    notes: Optional[str]
    is_blind_review: bool
    assessed_at: datetime
    
    model_config = {"from_attributes": True}


class ImageForReview(BaseModel):
    """Schema for image to be reviewed by expert."""
    id: UUID
    image_url: str
    image_type: Optional[str]
    dataset_id: Optional[UUID] = None
    dataset_name: Optional[str]
    
    model_config = {"from_attributes": True}
