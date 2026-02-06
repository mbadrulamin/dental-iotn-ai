"""
System Usability Scale (SUS) Questionnaire configuration.
Allows admins to customize the survey questions.
"""

import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SUSQuestionnaire(Base):
    """Stores the active SUS questionnaire configuration."""
    
    __tablename__ = "sus_questionnaires"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    # Store the 10 questions in a JSON object: {"q1": "...", "q2": "..."}
    questions: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        default={
            "q1": "I think that I would like to use this system frequently.",
            "q2": "I found the system unnecessarily complex.",
            "q3": "I thought the system was easy to use.",
            "q4": "I think that I would need the support of a technical person.",
            "q5": "I found the various functions in this system were well integrated.",
            "q6": "I thought there was too much inconsistency in this system.",
            "q7": "I would imagine that most people would learn to use this system very quickly.",
            "q8": "I found the system very cumbersome to use.",
            "q9": "I felt very confident using the system.",
            "q10": "I needed to learn a lot of things before I could get going with this system.",
        }
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
    
    # We will only use one active row (id = fixed or just fetch first)
    # For simplicity, we assume the first row is the active config.
    
    def __repr__(self) -> str:
        return f"<SUSQuestionnaire updated at {self.updated_at}>"