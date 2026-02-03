"""
Export service for generating CSV files for SPSS analysis.
"""

import csv
import io
from datetime import datetime
from typing import List, Dict, Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.image import Image
from app.models.inference import AIInference
from app.models.assessment import ExpertAssessment
from app.models.sus_response import SUSResponse


class ExportService:
    """Service for exporting data to CSV format for SPSS analysis."""
    
    @staticmethod
    async def export_validation_data(
        db: AsyncSession,
        dataset_id: UUID = None,
    ) -> str:
        """
        Export validation data (AI vs Expert) as CSV.
        
        Columns:
        - image_id
        - For each condition: ai_{condition}, ai_{condition}_confidence, expert_{condition}
        """
        # Build query
        query = (
            select(Image, AIInference, ExpertAssessment)
            .join(AIInference, Image.id == AIInference.image_id)
            .join(ExpertAssessment, Image.id == ExpertAssessment.image_id)
            .where(Image.is_validation_image == True)
        )
        
        if dataset_id:
            query = query.where(Image.dataset_id == dataset_id)
        
        result = await db.execute(query)
        rows = result.all()
        
        # Group by image and expert
        data_by_image_expert = {}
        for image, inference, assessment in rows:
            key = (str(image.id), str(assessment.expert_id))
            if key not in data_by_image_expert:
                data_by_image_expert[key] = {
                    "image_id": str(image.id),
                    "expert_id": str(assessment.expert_id),
                    "filename": image.original_filename,
                }
            
            # Add AI inference data
            model_name = inference.model_name.value
            data_by_image_expert[key][f"ai_{model_name}"] = (
                1 if inference.predicted_class and inference.predicted_class.value == "present" else 0
            )
            data_by_image_expert[key][f"ai_{model_name}_confidence"] = inference.confidence_score
            
            # Add expert assessment data
            data_by_image_expert[key]["expert_crossbite"] = (
                1 if assessment.crossbite_present.value == "yes" else 0
            )
            data_by_image_expert[key]["expert_overbite"] = (
                1 if assessment.overbite_present.value == "yes" else 0
            )
            data_by_image_expert[key]["expert_openbite"] = (
                1 if assessment.openbite_present.value == "yes" else 0
            )
            data_by_image_expert[key]["expert_displacement"] = (
                1 if assessment.displacement_present.value == "yes" else 0
            )
            data_by_image_expert[key]["expert_overjet"] = (
                1 if assessment.overjet_present.value == "yes" else 0
            )
        
        # Generate CSV
        output = io.StringIO()
        
        if data_by_image_expert:
            fieldnames = list(list(data_by_image_expert.values())[0].keys())
            writer = csv.DictWriter(output, fieldnames=fieldnames)
            writer.writeheader()
            for row in data_by_image_expert.values():
                writer.writerow(row)
        
        return output.getvalue()
    
    @staticmethod
    async def export_sus_data(db: AsyncSession) -> str:
        """
        Export SUS scores as CSV.
        
        Columns:
        - user_id, q1-q10, total_sus_score, submitted_at
        """
        result = await db.execute(select(SUSResponse))
        responses = result.scalars().all()
        
        output = io.StringIO()
        
        fieldnames = [
            "user_id",
            "q1_score", "q2_score", "q3_score", "q4_score", "q5_score",
            "q6_score", "q7_score", "q8_score", "q9_score", "q10_score",
            "total_sus_score",
            "submitted_at",
        ]
        
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        for response in responses:
            writer.writerow({
                "user_id": str(response.user_id),
                "q1_score": response.q1_score,
                "q2_score": response.q2_score,
                "q3_score": response.q3_score,
                "q4_score": response.q4_score,
                "q5_score": response.q5_score,
                "q6_score": response.q6_score,
                "q7_score": response.q7_score,
                "q8_score": response.q8_score,
                "q9_score": response.q9_score,
                "q10_score": response.q10_score,
                "total_sus_score": response.total_sus_score,
                "submitted_at": response.submitted_at.isoformat(),
            })
        
        return output.getvalue()
    
    @staticmethod
    async def export_performance_metrics(
        metrics: List[Dict[str, Any]],
    ) -> str:
        """
        Export performance metrics as CSV.
        """
        output = io.StringIO()
        
        fieldnames = [
            "condition",
            "tp", "tn", "fp", "fn",
            "sensitivity", "specificity",
            "precision", "accuracy", "f1_score",
            "total_samples",
        ]
        
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        for metric in metrics:
            cm = metric.get("confusion_matrix", {})
            writer.writerow({
                "condition": metric.get("condition"),
                "tp": cm.get("tp"),
                "tn": cm.get("tn"),
                "fp": cm.get("fp"),
                "fn": cm.get("fn"),
                "sensitivity": metric.get("sensitivity"),
                "specificity": metric.get("specificity"),
                "precision": metric.get("precision"),
                "accuracy": metric.get("accuracy"),
                "f1_score": metric.get("f1_score"),
                "total_samples": metric.get("total_samples"),
            })
        
        return output.getvalue()
