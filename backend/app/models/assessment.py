"""
Expert assessment model for blind validation reviews.
"""

import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AssessmentValue(str, PyEnum):
    """Expert assessment value."""
    YES = "yes"
    NO = "no"
    NA = "na"  # Not applicable


class ExpertAssessment(Base):
    """Expert assessment for blind validation."""
    
    __tablename__ = "expert_assessments"
    
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
    expert_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    
    # Qualitative assessments (Yes/No/NA)
    crossbite_present: Mapped[AssessmentValue] = mapped_column(
        Enum(AssessmentValue),
        default=AssessmentValue.NO,  # Assumed Negative
        nullable=False,
    )
    overbite_present: Mapped[AssessmentValue] = mapped_column(
        Enum(AssessmentValue),
        default=AssessmentValue.NO,
        nullable=False,
    )
    openbite_present: Mapped[AssessmentValue] = mapped_column(
        Enum(AssessmentValue),
        default=AssessmentValue.NO,
        nullable=False,
    )
    displacement_present: Mapped[AssessmentValue] = mapped_column(
        Enum(AssessmentValue),
        default=AssessmentValue.NO,
        nullable=False,
    )
    overjet_present: Mapped[AssessmentValue] = mapped_column(
        Enum(AssessmentValue),
        default=AssessmentValue.NO,
        nullable=False,
    )
    
    # Additional notes
    notes: Mapped[str] = mapped_column(
        Text,
        nullable=True,
    )
    
    # Blind review flag
    is_blind_review: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    
    assessed_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )
    
    # Relationships
    image = relationship("Image", back_populates="assessments")
    expert = relationship("User", back_populates="assessments")
    
    def __repr__(self) -> str:
        return f"<ExpertAssessment by {self.expert_id} on {self.image_id}>"
