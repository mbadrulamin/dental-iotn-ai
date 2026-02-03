"""
Analytics router for metrics and data export.
"""

from typing import Annotated, List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.models.image import Image
from app.models.inference import AIInference, ModelType, PredictionClass
from app.models.assessment import ExpertAssessment, AssessmentValue
from app.models.sus_response import SUSResponse
from app.schemas.analytics import (
    PerformanceMetrics,
    ConfusionMatrix,
    KappaResult,
    SUSInput,
    SUSResult,
    OverallMetrics,
    SUSStatistics,
)
from app.services.metrics_service import MetricsService
from app.services.export_service import ExportService
from app.routers.auth import get_current_user, require_role

router = APIRouter()


@router.get("/performance", response_model=List[PerformanceMetrics])
async def get_performance_metrics(
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN))],
    dataset_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Calculate performance metrics (Sensitivity, Specificity, Accuracy, F1).
    
    Compares AI inference results with expert annotations.
    """
    # Get all AI inferences
    query = select(AIInference).where(AIInference.model_name != ModelType.SEGMENTATION)
    result = await db.execute(query)
    inferences = result.scalars().all()
    
    # Get all expert assessments
    result = await db.execute(select(ExpertAssessment))
    assessments = result.scalars().all()
    
    # Group by condition
    conditions = ["crossbite", "overbite", "openbite", "displacement", "overjet"]
    metrics = []
    
    for condition in conditions:
        ai_predictions = []
        expert_labels = []
        
        # Get AI predictions for this condition
        model_type = ModelType(condition)
        condition_inferences = {
            inf.image_id: inf for inf in inferences 
            if inf.model_name == model_type
        }
        
        # Match with expert assessments
        for assessment in assessments:
            if assessment.image_id in condition_inferences:
                inf = condition_inferences[assessment.image_id]
                
                # AI prediction (present = True)
                ai_pred = inf.predicted_class == PredictionClass.PRESENT
                ai_predictions.append(ai_pred)
                
                # Expert label
                expert_value = getattr(assessment, f"{condition}_present")
                expert_label = expert_value == AssessmentValue.YES
                expert_labels.append(expert_label)
        
        if ai_predictions:
            condition_metrics = MetricsService.calculate_all_metrics(
                predictions=ai_predictions,
                ground_truth=expert_labels,
                condition=condition.capitalize(),
            )
            
            metrics.append(PerformanceMetrics(
                condition=condition_metrics["condition"],
                confusion_matrix=ConfusionMatrix(
                    tp=condition_metrics["confusion_matrix"]["tp"],
                    tn=condition_metrics["confusion_matrix"]["tn"],
                    fp=condition_metrics["confusion_matrix"]["fp"],
                    fn=condition_metrics["confusion_matrix"]["fn"],
                ),
                sensitivity=condition_metrics["sensitivity"],
                specificity=condition_metrics["specificity"],
                accuracy=condition_metrics["accuracy"],
                precision=condition_metrics["precision"],
                f1_score=condition_metrics["f1_score"],
                total_samples=condition_metrics["total_samples"],
            ))
    
    return metrics


@router.get("/kappa", response_model=List[KappaResult])
async def get_cohens_kappa(
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN))],
    dataset_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Calculate Cohen's Kappa for inter-rater agreement.
    
    Measures agreement between AI and expert annotations.
    """
    # Get all AI inferences
    query = select(AIInference).where(AIInference.model_name != ModelType.SEGMENTATION)
    result = await db.execute(query)
    inferences = result.scalars().all()
    
    # Get all expert assessments
    result = await db.execute(select(ExpertAssessment))
    assessments = result.scalars().all()
    
    conditions = ["crossbite", "overbite", "openbite", "displacement", "overjet"]
    kappa_results = []
    
    for condition in conditions:
        ai_ratings = []
        expert_ratings = []
        
        model_type = ModelType(condition)
        condition_inferences = {
            inf.image_id: inf for inf in inferences 
            if inf.model_name == model_type
        }
        
        for assessment in assessments:
            if assessment.image_id in condition_inferences:
                inf = condition_inferences[assessment.image_id]
                
                # AI rating (1 = present, 0 = absent)
                ai_rating = 1 if inf.predicted_class == PredictionClass.PRESENT else 0
                ai_ratings.append(ai_rating)
                
                # Expert rating
                expert_value = getattr(assessment, f"{condition}_present")
                expert_rating = 1 if expert_value == AssessmentValue.YES else 0
                expert_ratings.append(expert_rating)
        
        if ai_ratings:
            kappa = MetricsService.calculate_cohens_kappa(ai_ratings, expert_ratings)
            
            kappa_results.append(KappaResult(
                condition=condition.capitalize(),
                kappa=kappa["kappa"],
                interpretation=kappa["interpretation"],
                observed_agreement=kappa["observed_agreement"],
                expected_agreement=kappa["expected_agreement"],
            ))
    
    return kappa_results


@router.post("/sus", response_model=SUSResult)
async def submit_sus_response(
    sus_input: SUSInput,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Submit SUS questionnaire response."""
    # Calculate SUS score
    responses_dict = {
        "q1_score": sus_input.q1_score,
        "q2_score": sus_input.q2_score,
        "q3_score": sus_input.q3_score,
        "q4_score": sus_input.q4_score,
        "q5_score": sus_input.q5_score,
        "q6_score": sus_input.q6_score,
        "q7_score": sus_input.q7_score,
        "q8_score": sus_input.q8_score,
        "q9_score": sus_input.q9_score,
        "q10_score": sus_input.q10_score,
    }
    
    sus_result = MetricsService.calculate_sus_score(responses_dict)
    
    # Create response record
    response = SUSResponse(
        user_id=current_user.id,
        q1_score=sus_input.q1_score,
        q2_score=sus_input.q2_score,
        q3_score=sus_input.q3_score,
        q4_score=sus_input.q4_score,
        q5_score=sus_input.q5_score,
        q6_score=sus_input.q6_score,
        q7_score=sus_input.q7_score,
        q8_score=sus_input.q8_score,
        q9_score=sus_input.q9_score,
        q10_score=sus_input.q10_score,
        total_sus_score=sus_result["total_sus_score"],
    )
    db.add(response)
    await db.flush()
    await db.refresh(response)
    
    return SUSResult(
        id=response.id,
        user_id=response.user_id,
        scores=responses_dict,
        total_sus_score=sus_result["total_sus_score"],
        grade=sus_result["grade"],
        submitted_at=response.submitted_at,
    )


@router.get("/sus/statistics", response_model=SUSStatistics)
async def get_sus_statistics(
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN))],
    db: AsyncSession = Depends(get_db),
):
    """Get aggregate SUS statistics."""
    result = await db.execute(select(SUSResponse))
    responses = result.scalars().all()
    
    if not responses:
        return SUSStatistics(
            total_responses=0,
            mean_score=0,
            median_score=0,
            std_deviation=0,
            min_score=0,
            max_score=0,
            grade_distribution={},
        )
    
    scores = [r.total_sus_score for r in responses]
    scores.sort()
    
    # Calculate statistics
    mean_score = sum(scores) / len(scores)
    median_score = scores[len(scores) // 2]
    
    variance = sum((s - mean_score) ** 2 for s in scores) / len(scores)
    std_deviation = variance ** 0.5
    
    # Grade distribution
    grade_dist = {}
    for response in responses:
        grade = MetricsService._sus_grade(response.total_sus_score)
        grade_dist[grade] = grade_dist.get(grade, 0) + 1
    
    return SUSStatistics(
        total_responses=len(responses),
        mean_score=round(mean_score, 2),
        median_score=round(median_score, 2),
        std_deviation=round(std_deviation, 2),
        min_score=min(scores),
        max_score=max(scores),
        grade_distribution=grade_dist,
    )


@router.get("/export/validation-csv")
async def export_validation_csv(
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN))],
    dataset_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
):
    """Export validation data as CSV for SPSS analysis."""
    csv_content = await ExportService.export_validation_data(db, dataset_id)
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=validation_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        },
    )


@router.get("/export/sus-csv")
async def export_sus_csv(
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN))],
    db: AsyncSession = Depends(get_db),
):
    """Export SUS scores as CSV."""
    csv_content = await ExportService.export_sus_data(db)
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=sus_scores_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        },
    )


@router.get("/export/metrics-csv")
async def export_metrics_csv(
    current_user: Annotated[User, Depends(require_role(UserRole.ADMIN))],
    dataset_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
):
    """Export performance metrics as CSV."""
    # Get metrics
    metrics = await get_performance_metrics(current_user, dataset_id, db)
    
    # Convert to dict format
    metrics_dicts = [
        {
            "condition": m.condition,
            "confusion_matrix": {
                "tp": m.confusion_matrix.true_positive,
                "tn": m.confusion_matrix.true_negative,
                "fp": m.confusion_matrix.false_positive,
                "fn": m.confusion_matrix.false_negative,
            },
            "sensitivity": m.sensitivity,
            "specificity": m.specificity,
            "precision": m.precision,
            "accuracy": m.accuracy,
            "f1_score": m.f1_score,
            "total_samples": m.total_samples,
        }
        for m in metrics
    ]
    
    csv_content = await ExportService.export_performance_metrics(metrics_dicts)
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=performance_metrics_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        },
    )
