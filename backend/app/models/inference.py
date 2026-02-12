"""
AI inference model for storing model predictions.
"""

import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import String, Float, Integer, DateTime, Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ModelType(str, PyEnum):
    """Type of AI model."""
    CROSSBITE = "crossbite"
    OVERBITE = "overbite"
    OPENBITE = "openbite"
    DISPLACEMENT = "displacement"
    OVERJET = "overjet"
    SEGMENTATION = "segmentation"


class PredictionClass(str, PyEnum):
    """Prediction class for classification models."""
    PRESENT = "present"
    ABSENT = "absent"


class AIInference(Base):
    """AI inference results from models."""
    
    __tablename__ = "ai_inferences"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    image_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("images.id"),
        nullable=False,
        index=True,
    )
    model_type: Mapped[ModelType] = mapped_column(
        Enum(ModelType),
        nullable=False,
    )
    model_version: Mapped[str] = mapped_column(
        String(50),
        nullable=True,
    )
    
    # Classification results
    predicted_class: Mapped[PredictionClass] = mapped_column(
        Enum(PredictionClass),
        nullable=True,
    )
    confidence_score: Mapped[float] = mapped_column(
        Float,
        nullable=True,
    )
    
    # Segmentation results (for segmentation model)
    segmentation_mask_path: Mapped[str] = mapped_column(
        String(500),
        nullable=True,
    )
    segmentation_data: Mapped[dict] = mapped_column(
        JSON,
        nullable=True,
    )
    
    # Raw model output for debugging
    raw_output: Mapped[dict] = mapped_column(
        JSON,
        nullable=True,
    )
    
    # Processing info
    inference_time_ms: Mapped[int] = mapped_column(
        Integer,
        nullable=True,
    )
    processed_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )
    
    # Relationships
    image = relationship("Image", back_populates="inferences")
    
    def __repr__(self) -> str:
        return f"<AIInference {self.model_name.value}: {self.predicted_class}>"
