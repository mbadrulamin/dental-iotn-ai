"""
Clinical measurement model for IOTN grading inputs.
"""

import uuid
from datetime import datetime

from sqlalchemy import Float, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ClinicalMeasurement(Base):
    """Clinical measurements for IOTN grade calculation."""
    
    __tablename__ = "clinical_measurements"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    image_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("images.id"),
        nullable=False,
        unique=True,  # One measurement per image
    )
    
    # Measurements in millimeters
    overjet_mm: Mapped[float] = mapped_column(Float, nullable=True)
    reverse_overjet_mm: Mapped[float] = mapped_column(Float, nullable=True)
    overbite_mm: Mapped[float] = mapped_column(Float, nullable=True)
    displacement_mm: Mapped[float] = mapped_column(Float, nullable=True)
    crossbite_displacement_mm: Mapped[float] = mapped_column(Float, nullable=True)
    open_bite_mm: Mapped[float] = mapped_column(Float, nullable=True)
    
    # Additional clinical indicators
    lips_competent: Mapped[bool] = mapped_column(Boolean, nullable=True)
    gingival_contact: Mapped[bool] = mapped_column(Boolean, nullable=True)
    gingival_trauma: Mapped[bool] = mapped_column(Boolean, nullable=True)
    speech_difficulty: Mapped[bool] = mapped_column(Boolean, nullable=True)
    masticatory_difficulty: Mapped[bool] = mapped_column(Boolean, nullable=True)
    
    # Calculated IOTN grade
    calculated_iotn_grade: Mapped[int] = mapped_column(nullable=True)
    
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )
    
    # Relationships
    image = relationship("Image", back_populates="measurements")
    
    def __repr__(self) -> str:
        return f"<ClinicalMeasurement IOTN Grade {self.calculated_iotn_grade}>"
