"""
Image model for storing uploaded dental images.
"""

import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import String, Boolean, DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ImageType(str, PyEnum):
    """Type of dental image."""
    FRONTAL = "frontal"
    LATERAL = "lateral"
    OCCLUSAL = "occlusal"


class Image(Base):
    """Image model for uploaded dental images."""
    
    __tablename__ = "images"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    dataset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("datasets.id"),
        nullable=True,  # Public uploads may not belong to a dataset
    )
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,  # Guest uploads may not have a user
    )
    filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    original_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    file_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    file_size: Mapped[int] = mapped_column(
        nullable=False,
    )
    mime_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    image_type: Mapped[ImageType] = mapped_column(
        Enum(ImageType),
        nullable=True,
    )
    is_processed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    is_validation_image: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )
    
    # Relationships
    dataset = relationship("Dataset", back_populates="images")
    uploaded_by_user = relationship("User", back_populates="images")
    measurements = relationship("ClinicalMeasurement", back_populates="image", uselist=False)
    inferences = relationship("AIInference", back_populates="image")
    assessments = relationship("ExpertAssessment", back_populates="image")
    
    def __repr__(self) -> str:
        return f"<Image {self.original_filename}>"
