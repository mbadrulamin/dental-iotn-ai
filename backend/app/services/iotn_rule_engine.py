"""
IOTN DHC Rule Engine for grading calculations.
"""

from dataclasses import dataclass
from typing import Optional, List, Tuple
from enum import Enum


class IOTNGrade(Enum):
    """IOTN DHC Grade enumeration."""
    GRADE_1 = 1  # No need for treatment
    GRADE_2 = 2  # Little need for treatment
    GRADE_3 = 3  # Borderline need for treatment
    GRADE_4 = 4  # Need for treatment
    GRADE_5 = 5  # Very great need for treatment


GRADE_DESCRIPTIONS = {
    1: "No Need for Treatment",
    2: "Little Need for Treatment",
    3: "Borderline Need for Treatment",
    4: "Need for Treatment",
    5: "Very Great Need for Treatment",
}

TREATMENT_NEEDS = {
    1: "No treatment required - teeth are essentially normal",
    2: "Minor irregularities - treatment optional",
    3: "Moderate problems - treatment advisable",
    4: "Treatment required for dental health",
    5: "Treatment mandatory - severe dental health issues",
}


@dataclass
class GradeResult:
    """Result of a single condition grade calculation."""
    condition: str
    grade: int
    reason: str


@dataclass
class IOTNResult:
    """Final IOTN grade result."""
    grade: int
    grade_description: str
    determining_factor: str
    treatment_need: str
    all_conditions: List[GradeResult]


class IOTNRuleEngine:
    """
    IOTN DHC Rule Engine.
    
    Implements the Index of Orthodontic Treatment Need (IOTN) 
    Dental Health Component (DHC) grading rules.
    """
    
    @staticmethod
    def calculate_displacement_grade(mm: Optional[float]) -> GradeResult:
        """
        Calculate IOTN grade for displacement.
        
        Grade 1: ≤1mm
        Grade 2: >1mm to ≤2mm
        Grade 3: >2mm to ≤4mm
        Grade 4: >4mm
        """
        if mm is None:
            return GradeResult("Displacement", 0, "Not measured")
        
        if mm <= 1.0:
            return GradeResult("Displacement", 1, f"Displacement ≤1mm ({mm}mm)")
        elif mm <= 2.0:
            return GradeResult("Displacement", 2, f"Displacement >1mm to ≤2mm ({mm}mm)")
        elif mm <= 4.0:
            return GradeResult("Displacement", 3, f"Displacement >2mm to ≤4mm ({mm}mm)")
        else:
            return GradeResult("Displacement", 4, f"Displacement >4mm ({mm}mm)")
    
    @staticmethod
    def calculate_overjet_grade(
        mm: Optional[float],
        lips_competent: Optional[bool] = None,
    ) -> GradeResult:
        """
        Calculate IOTN grade for increased overjet.
        
        Grade 2: >3.5mm to ≤6mm (lips competent)
        Grade 3: >3.5mm to ≤6mm (lips incompetent)
        Grade 4: >6mm to ≤9mm
        Grade 5: >9mm
        """
        if mm is None:
            return GradeResult("Overjet", 0, "Not measured")
        
        if mm <= 3.5:
            return GradeResult("Overjet", 1, f"Overjet ≤3.5mm ({mm}mm) - Normal")
        elif mm <= 6.0:
            if lips_competent is True:
                return GradeResult("Overjet", 2, f"Overjet >3.5mm to ≤6mm with competent lips ({mm}mm)")
            elif lips_competent is False:
                return GradeResult("Overjet", 3, f"Overjet >3.5mm to ≤6mm with incompetent lips ({mm}mm)")
            else:
                # Default to Grade 2 if lip competence not specified
                return GradeResult("Overjet", 2, f"Overjet >3.5mm to ≤6mm ({mm}mm)")
        elif mm <= 9.0:
            return GradeResult("Overjet", 4, f"Overjet >6mm to ≤9mm ({mm}mm)")
        else:
            return GradeResult("Overjet", 5, f"Overjet >9mm ({mm}mm)")
    
    @staticmethod
    def calculate_reverse_overjet_grade(
        mm: Optional[float],
        has_difficulty: Optional[bool] = None,
    ) -> GradeResult:
        """
        Calculate IOTN grade for reverse overjet.
        
        Grade 2: >0mm to ≤1mm
        Grade 3: >1mm to ≤3.5mm
        Grade 4: >3.5mm (no difficulty) OR >1mm to ≤3.5mm (with difficulty)
        Grade 5: >3.5mm (with difficulty)
        """
        if mm is None:
            return GradeResult("Reverse Overjet", 0, "Not measured")
        
        if mm <= 0:
            return GradeResult("Reverse Overjet", 1, "No reverse overjet")
        elif mm <= 1.0:
            return GradeResult("Reverse Overjet", 2, f"Reverse overjet >0mm to ≤1mm ({mm}mm)")
        elif mm <= 3.5:
            if has_difficulty is True:
                return GradeResult("Reverse Overjet", 4, f"Reverse overjet >1mm to ≤3.5mm with speech/masticatory difficulty ({mm}mm)")
            else:
                return GradeResult("Reverse Overjet", 3, f"Reverse overjet >1mm to ≤3.5mm ({mm}mm)")
        else:
            if has_difficulty is True:
                return GradeResult("Reverse Overjet", 5, f"Reverse overjet >3.5mm with speech/masticatory difficulty ({mm}mm)")
            else:
                return GradeResult("Reverse Overjet", 4, f"Reverse overjet >3.5mm without reported difficulty ({mm}mm)")
    
    @staticmethod
    def calculate_overbite_grade(
        mm: Optional[float],
        gingival_contact: Optional[bool] = None,
        has_trauma: Optional[bool] = None,
    ) -> GradeResult:
        """
        Calculate IOTN grade for increased overbite.
        
        Grade 2: >3.5mm (no gingival contact)
        Grade 3: Complete with gingival contact (no trauma)
        Grade 4: Complete with indentation/trauma
        """
        if mm is None:
            return GradeResult("Overbite", 0, "Not measured")
        
        if mm <= 3.5:
            return GradeResult("Overbite", 1, f"Overbite ≤3.5mm ({mm}mm) - Normal")
        else:
            if has_trauma is True:
                return GradeResult("Overbite", 4, f"Overbite >3.5mm with gingival trauma/indentation ({mm}mm)")
            elif gingival_contact is True:
                return GradeResult("Overbite", 3, f"Overbite >3.5mm with gingival contact ({mm}mm)")
            else:
                return GradeResult("Overbite", 2, f"Overbite >3.5mm without gingival contact ({mm}mm)")
    
    @staticmethod
    def calculate_crossbite_grade(displacement_mm: Optional[float]) -> GradeResult:
        """
        Calculate IOTN grade for crossbite (RCP-ICP displacement).
        
        Grade 2: ≤1mm
        Grade 3: >1mm to ≤2mm
        Grade 4: >2mm
        """
        if displacement_mm is None:
            return GradeResult("Crossbite", 0, "Not measured")
        
        if displacement_mm <= 0:
            return GradeResult("Crossbite", 1, "No crossbite")
        elif displacement_mm <= 1.0:
            return GradeResult("Crossbite", 2, f"Crossbite displacement ≤1mm ({displacement_mm}mm)")
        elif displacement_mm <= 2.0:
            return GradeResult("Crossbite", 3, f"Crossbite displacement >1mm to ≤2mm ({displacement_mm}mm)")
        else:
            return GradeResult("Crossbite", 4, f"Crossbite displacement >2mm ({displacement_mm}mm)")
    
    @staticmethod
    def calculate_openbite_grade(mm: Optional[float]) -> GradeResult:
        """
        Calculate IOTN grade for open bite (lateral or anterior).
        
        Grade 2: >1mm to ≤2mm
        Grade 3: >2mm to ≤4mm
        Grade 4: >4mm
        """
        if mm is None:
            return GradeResult("Open Bite", 0, "Not measured")
        
        if mm <= 1.0:
            return GradeResult("Open Bite", 1, f"Open bite ≤1mm ({mm}mm) - Normal")
        elif mm <= 2.0:
            return GradeResult("Open Bite", 2, f"Open bite >1mm to ≤2mm ({mm}mm)")
        elif mm <= 4.0:
            return GradeResult("Open Bite", 3, f"Open bite >2mm to ≤4mm ({mm}mm)")
        else:
            return GradeResult("Open Bite", 4, f"Open bite >4mm ({mm}mm)")
    
    @classmethod
    def calculate_final_grade(
        cls,
        overjet_mm: Optional[float] = None,
        reverse_overjet_mm: Optional[float] = None,
        overbite_mm: Optional[float] = None,
        displacement_mm: Optional[float] = None,
        crossbite_displacement_mm: Optional[float] = None,
        open_bite_mm: Optional[float] = None,
        lips_competent: Optional[bool] = None,
        gingival_contact: Optional[bool] = None,
        gingival_trauma: Optional[bool] = None,
        speech_difficulty: Optional[bool] = None,
        masticatory_difficulty: Optional[bool] = None,
    ) -> IOTNResult:
        """
        Calculate the final IOTN DHC grade.
        
        The highest grade from any single condition determines the final grade.
        """
        has_difficulty = speech_difficulty or masticatory_difficulty
        
        # Calculate all condition grades
        condition_results = [
            cls.calculate_displacement_grade(displacement_mm),
            cls.calculate_overjet_grade(overjet_mm, lips_competent),
            cls.calculate_reverse_overjet_grade(reverse_overjet_mm, has_difficulty),
            cls.calculate_overbite_grade(overbite_mm, gingival_contact, gingival_trauma),
            cls.calculate_crossbite_grade(crossbite_displacement_mm),
            cls.calculate_openbite_grade(open_bite_mm),
        ]
        
        # Filter out conditions that weren't measured
        measured_results = [r for r in condition_results if r.grade > 0]
        
        if not measured_results:
            return IOTNResult(
                grade=1,
                grade_description=GRADE_DESCRIPTIONS[1],
                determining_factor="No measurements provided",
                treatment_need=TREATMENT_NEEDS[1],
                all_conditions=condition_results,
            )
        
        # Find the highest grade (determines final IOTN)
        max_result = max(measured_results, key=lambda r: r.grade)
        
        return IOTNResult(
            grade=max_result.grade,
            grade_description=GRADE_DESCRIPTIONS[max_result.grade],
            determining_factor=max_result.reason,
            treatment_need=TREATMENT_NEEDS[max_result.grade],
            all_conditions=condition_results,
        )
