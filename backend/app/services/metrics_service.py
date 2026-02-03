"""
Metrics service for calculating research performance metrics.
"""

from typing import List, Dict, Tuple
from collections import Counter
import math


class MetricsService:
    """
    Service for calculating performance metrics and agreement statistics.
    
    Used to compare AI inference results with expert annotations.
    """
    
    @staticmethod
    def calculate_confusion_matrix(
        predictions: List[bool],
        ground_truth: List[bool],
    ) -> Dict[str, int]:
        """
        Calculate confusion matrix values.
        
        Args:
            predictions: List of AI predictions (True = present, False = absent)
            ground_truth: List of expert labels (True = present, False = absent)
            
        Returns:
            Dict with tp, tn, fp, fn counts
        """
        tp = sum(1 for p, g in zip(predictions, ground_truth) if p and g)
        tn = sum(1 for p, g in zip(predictions, ground_truth) if not p and not g)
        fp = sum(1 for p, g in zip(predictions, ground_truth) if p and not g)
        fn = sum(1 for p, g in zip(predictions, ground_truth) if not p and g)
        
        return {"tp": tp, "tn": tn, "fp": fp, "fn": fn}
    
    @staticmethod
    def calculate_sensitivity(tp: int, fn: int) -> float:
        """
        Calculate sensitivity (True Positive Rate / Recall).
        
        Sensitivity = TP / (TP + FN)
        """
        if tp + fn == 0:
            return 0.0
        return tp / (tp + fn)
    
    @staticmethod
    def calculate_specificity(tn: int, fp: int) -> float:
        """
        Calculate specificity (True Negative Rate).
        
        Specificity = TN / (TN + FP)
        """
        if tn + fp == 0:
            return 0.0
        return tn / (tn + fp)
    
    @staticmethod
    def calculate_precision(tp: int, fp: int) -> float:
        """
        Calculate precision (Positive Predictive Value).
        
        Precision = TP / (TP + FP)
        """
        if tp + fp == 0:
            return 0.0
        return tp / (tp + fp)
    
    @staticmethod
    def calculate_accuracy(tp: int, tn: int, fp: int, fn: int) -> float:
        """
        Calculate accuracy.
        
        Accuracy = (TP + TN) / Total
        """
        total = tp + tn + fp + fn
        if total == 0:
            return 0.0
        return (tp + tn) / total
    
    @staticmethod
    def calculate_f1_score(precision: float, recall: float) -> float:
        """
        Calculate F1 score (harmonic mean of precision and recall).
        
        F1 = 2 * (precision * recall) / (precision + recall)
        """
        if precision + recall == 0:
            return 0.0
        return 2 * (precision * recall) / (precision + recall)
    
    @classmethod
    def calculate_all_metrics(
        cls,
        predictions: List[bool],
        ground_truth: List[bool],
        condition: str = "Unknown",
    ) -> Dict:
        """
        Calculate all performance metrics for a condition.
        
        Args:
            predictions: AI predictions
            ground_truth: Expert labels
            condition: Name of the condition (e.g., "Crossbite")
            
        Returns:
            Dict with all metrics
        """
        cm = cls.calculate_confusion_matrix(predictions, ground_truth)
        
        sensitivity = cls.calculate_sensitivity(cm["tp"], cm["fn"])
        specificity = cls.calculate_specificity(cm["tn"], cm["fp"])
        precision = cls.calculate_precision(cm["tp"], cm["fp"])
        accuracy = cls.calculate_accuracy(cm["tp"], cm["tn"], cm["fp"], cm["fn"])
        f1 = cls.calculate_f1_score(precision, sensitivity)  # recall = sensitivity
        
        return {
            "condition": condition,
            "confusion_matrix": cm,
            "sensitivity": round(sensitivity, 4),
            "specificity": round(specificity, 4),
            "precision": round(precision, 4),
            "accuracy": round(accuracy, 4),
            "f1_score": round(f1, 4),
            "total_samples": len(predictions),
        }
    
    @staticmethod
    def calculate_cohens_kappa(
        rater1: List[int],
        rater2: List[int],
    ) -> Dict:
        """
        Calculate Cohen's Kappa for inter-rater agreement.
        
        Kappa = (Po - Pe) / (1 - Pe)
        
        Where:
        - Po = Observed agreement
        - Pe = Expected agreement by chance
        
        Args:
            rater1: List of labels from rater 1 (AI)
            rater2: List of labels from rater 2 (Expert)
            
        Returns:
            Dict with kappa value and interpretation
        """
        if len(rater1) != len(rater2):
            raise ValueError("Both raters must have the same number of ratings")
        
        n = len(rater1)
        if n == 0:
            return {
                "kappa": 0.0,
                "interpretation": "No data",
                "observed_agreement": 0.0,
                "expected_agreement": 0.0,
            }
        
        # Count agreements
        agreements = sum(1 for r1, r2 in zip(rater1, rater2) if r1 == r2)
        
        # Observed agreement
        po = agreements / n
        
        # Get unique categories
        categories = set(rater1) | set(rater2)
        
        # Calculate expected agreement
        pe = 0.0
        for cat in categories:
            p1 = sum(1 for r in rater1 if r == cat) / n
            p2 = sum(1 for r in rater2 if r == cat) / n
            pe += p1 * p2
        
        # Calculate kappa
        if pe == 1.0:
            kappa = 1.0 if po == 1.0 else 0.0
        else:
            kappa = (po - pe) / (1 - pe)
        
        # Interpret kappa value
        interpretation = MetricsService._interpret_kappa(kappa)
        
        return {
            "kappa": round(kappa, 4),
            "interpretation": interpretation,
            "observed_agreement": round(po, 4),
            "expected_agreement": round(pe, 4),
        }
    
    @staticmethod
    def _interpret_kappa(kappa: float) -> str:
        """Interpret Cohen's Kappa value."""
        if kappa < 0:
            return "Poor Agreement (Less than chance)"
        elif kappa < 0.20:
            return "Slight Agreement"
        elif kappa < 0.40:
            return "Fair Agreement"
        elif kappa < 0.60:
            return "Moderate Agreement"
        elif kappa < 0.80:
            return "Substantial Agreement"
        else:
            return "Almost Perfect Agreement"
    
    @staticmethod
    def calculate_sus_score(responses: Dict[str, int]) -> Dict:
        """
        Calculate SUS (System Usability Scale) score.
        
        Standard SUS formula:
        - For odd questions (1,3,5,7,9): score contribution = raw score - 1
        - For even questions (2,4,6,8,10): score contribution = 5 - raw score
        - Total = sum of contributions * 2.5
        
        Args:
            responses: Dict with q1_score through q10_score (1-5 each)
            
        Returns:
            Dict with total_sus_score and grade
        """
        odd_sum = (
            (responses.get("q1_score", 3) - 1) +
            (responses.get("q3_score", 3) - 1) +
            (responses.get("q5_score", 3) - 1) +
            (responses.get("q7_score", 3) - 1) +
            (responses.get("q9_score", 3) - 1)
        )
        
        even_sum = (
            (5 - responses.get("q2_score", 3)) +
            (5 - responses.get("q4_score", 3)) +
            (5 - responses.get("q6_score", 3)) +
            (5 - responses.get("q8_score", 3)) +
            (5 - responses.get("q10_score", 3))
        )
        
        total_score = (odd_sum + even_sum) * 2.5
        
        # Determine grade based on score
        grade = MetricsService._sus_grade(total_score)
        
        return {
            "total_sus_score": round(total_score, 2),
            "grade": grade,
        }
    
    @staticmethod
    def _sus_grade(score: float) -> str:
        """Convert SUS score to letter grade."""
        if score >= 84.1:
            return "A+"
        elif score >= 80.8:
            return "A"
        elif score >= 78.9:
            return "A-"
        elif score >= 77.2:
            return "B+"
        elif score >= 74.1:
            return "B"
        elif score >= 72.6:
            return "B-"
        elif score >= 71.1:
            return "C+"
        elif score >= 65.0:
            return "C"
        elif score >= 62.7:
            return "C-"
        elif score >= 51.7:
            return "D"
        else:
            return "F"
