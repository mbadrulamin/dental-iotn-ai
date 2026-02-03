"""
System Usability Scale (SUS) response model.
"""

import uuid
from datetime import datetime

from sqlalchemy import Integer, Float, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SUSResponse(Base):
    """System Usability Scale (SUS) questionnaire responses."""
    
    __tablename__ = "sus_responses"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    
    # SUS Questions (1-5 Likert scale: Strongly Disagree to Strongly Agree)
    # Q1: I think that I would like to use this system frequently.
    q1_score: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # Q2: I found the system unnecessarily complex.
    q2_score: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # Q3: I thought the system was easy to use.
    q3_score: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # Q4: I think that I would need the support of a technical person.
    q4_score: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # Q5: I found the various functions in this system were well integrated.
    q5_score: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # Q6: I thought there was too much inconsistency in this system.
    q6_score: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # Q7: I would imagine that most people would learn to use this system very quickly.
    q7_score: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # Q8: I found the system very cumbersome to use.
    q8_score: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # Q9: I felt very confident using the system.
    q9_score: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # Q10: I needed to learn a lot of things before I could get going with this system.
    q10_score: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # Calculated SUS score (0-100)
    total_sus_score: Mapped[float] = mapped_column(
        Float,
        nullable=True,
    )
    
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )
    
    # Relationships
    user = relationship("User", back_populates="sus_responses")
    
    def calculate_sus_score(self) -> float:
        """
        Calculate the SUS score using the standard formula.
        
        For odd questions (1,3,5,7,9): score contribution = raw score - 1
        For even questions (2,4,6,8,10): score contribution = 5 - raw score
        Total = sum of contributions * 2.5
        """
        odd_sum = (
            (self.q1_score - 1) +
            (self.q3_score - 1) +
            (self.q5_score - 1) +
            (self.q7_score - 1) +
            (self.q9_score - 1)
        )
        even_sum = (
            (5 - self.q2_score) +
            (5 - self.q4_score) +
            (5 - self.q6_score) +
            (5 - self.q8_score) +
            (5 - self.q10_score)
        )
        return (odd_sum + even_sum) * 2.5
    
    def __repr__(self) -> str:
        return f"<SUSResponse score={self.total_sus_score}>"
