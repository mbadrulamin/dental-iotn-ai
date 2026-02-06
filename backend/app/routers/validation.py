"""
Validation router for expert blind review.
"""

from typing import Annotated, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.models.image import Image
from app.models.dataset import Dataset
from app.models.assessment import ExpertAssessment, AssessmentValue
from app.schemas.assessment import AssessmentCreate, AssessmentResponse, ImageForReview
from app.routers.auth import get_current_user, require_role

router = APIRouter()


@router.get("/next", response_model=Optional[ImageForReview])
async def get_next_image(
    current_user: Annotated[User, Depends(require_role(UserRole.EXPERT, UserRole.ADMIN))],
    dataset_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Get the next image for blind review.
    
    Now filters by datasets assigned to the expert.
    """
    # Subquery for images already reviewed
    subquery = (
        select(ExpertAssessment.image_id)
        .where(ExpertAssessment.expert_id == current_user.id)
    )
    
    # Base query for unreviewed images
    query = (
        select(Image)
        .join(Dataset, Image.dataset_id == Dataset.id)
        .where(
            and_(
                Image.is_validation_image == True,
                Image.id.notin_(subquery),
            )
        )
    )
    
    # Logic: Admins see everything (unless dataset specified). 
    # Experts ONLY see datasets assigned to them.
    if current_user.role == UserRole.EXPERT:
        # Filter by assigned datasets
        query = query.where(Dataset.id.in_(
            select(dataset_experts.c.dataset_id).where(
                dataset_experts.c.expert_id == current_user.id
            )
        ))
    
    if dataset_id:
        # If specific dataset requested, ensure user has access
        if current_user.role == UserRole.EXPERT:
             # Check if expert is assigned to this specific dataset
             assignment_check = await db.execute(
                 select(dataset_experts).where(
                     and_(
                         dataset_experts.c.dataset_id == dataset_id,
                         dataset_experts.c.expert_id == current_user.id
                     )
                 )
             )
             if not assignment_check.first():
                 raise HTTPException(status_code=403, detail="Not assigned to this dataset")
        
        query = query.where(Image.dataset_id == dataset_id)
    elif current_user.role == UserRole.EXPERT:
        # If no dataset specified for expert, just pick from any assigned
        pass
        
    query = query.order_by(Image.uploaded_at).limit(1)
    
    result = await db.execute(query)
    image = result.scalar_one_or_none()
    
    if not image:
        return None
    
    # Get dataset name
    dataset_name = None
    if image.dataset_id:
        ds_result = await db.execute(
            select(Dataset).where(Dataset.id == image.dataset_id)
        )
        dataset = ds_result.scalar_one_or_none()
        dataset_name = dataset.name if dataset else None
    
    return ImageForReview(
        id=image.id,
        image_url=f"/uploads/images/{image.filename}",
        image_type=image.image_type.value if image.image_type else None,
        dataset_name=dataset_name,
    )


@router.get("/queue", response_model=List[ImageForReview])
async def get_review_queue(
    current_user: Annotated[User, Depends(require_role(UserRole.EXPERT, UserRole.ADMIN))],
    dataset_id: Optional[UUID] = None,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """Get queue of images pending expert review."""
    # Build query for images not yet reviewed by this expert
    subquery = (
        select(ExpertAssessment.image_id)
        .where(ExpertAssessment.expert_id == current_user.id)
    )
    
    query = (
        select(Image)
        .where(
            and_(
                Image.is_validation_image == True,
                Image.id.notin_(subquery),
            )
        )
    )
    
    if dataset_id:
        query = query.where(Image.dataset_id == dataset_id)
    
    query = query.order_by(Image.uploaded_at).limit(limit)
    
    result = await db.execute(query)
    images = result.scalars().all()
    
    # Build response
    queue = []
    for image in images:
        dataset_name = None
        if image.dataset_id:
            ds_result = await db.execute(
                select(Dataset).where(Dataset.id == image.dataset_id)
            )
            dataset = ds_result.scalar_one_or_none()
            dataset_name = dataset.name if dataset else None
        
        queue.append(ImageForReview(
            id=image.id,
            image_url=f"/uploads/images/{image.filename}",
            image_type=image.image_type.value if image.image_type else None,
            dataset_name=dataset_name,
        ))
    
    return queue


@router.post("/assess", response_model=AssessmentResponse)
async def submit_assessment(
    assessment_data: AssessmentCreate,
    current_user: Annotated[User, Depends(require_role(UserRole.EXPERT, UserRole.ADMIN))],
    db: AsyncSession = Depends(get_db),
):
    """
    Submit expert assessment for an image.
    
    Uses "Assumed Negative" logic - default is NO (absent).
    """
    # Check if image exists
    result = await db.execute(
        select(Image).where(Image.id == assessment_data.image_id)
    )
    image = result.scalar_one_or_none()
    
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found",
        )
    
    # Check if already assessed by this expert
    result = await db.execute(
        select(ExpertAssessment).where(
            and_(
                ExpertAssessment.image_id == assessment_data.image_id,
                ExpertAssessment.expert_id == current_user.id,
            )
        )
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already assessed this image",
        )
    
    # Create assessment
    assessment = ExpertAssessment(
        image_id=assessment_data.image_id,
        expert_id=current_user.id,
        crossbite_present=AssessmentValue(assessment_data.crossbite_present.value),
        overbite_present=AssessmentValue(assessment_data.overbite_present.value),
        openbite_present=AssessmentValue(assessment_data.openbite_present.value),
        displacement_present=AssessmentValue(assessment_data.displacement_present.value),
        overjet_present=AssessmentValue(assessment_data.overjet_present.value),
        notes=assessment_data.notes,
        is_blind_review=True,
    )
    db.add(assessment)
    await db.flush()
    await db.refresh(assessment)
    
    return assessment


@router.get("/my-assessments", response_model=List[AssessmentResponse])
async def get_my_assessments(
    current_user: Annotated[User, Depends(require_role(UserRole.EXPERT, UserRole.ADMIN))],
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """Get assessments submitted by the current expert."""
    result = await db.execute(
        select(ExpertAssessment)
        .where(ExpertAssessment.expert_id == current_user.id)
        .order_by(ExpertAssessment.assessed_at.desc())
        .limit(limit)
    )
    assessments = result.scalars().all()
    
    return assessments


@router.get("/progress")
async def get_review_progress(
    current_user: Annotated[User, Depends(require_role(UserRole.EXPERT, UserRole.ADMIN))],
    dataset_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get expert's review progress."""
    # Count total validation images
    query = select(Image).where(Image.is_validation_image == True)
    if dataset_id:
        query = query.where(Image.dataset_id == dataset_id)
    
    result = await db.execute(query)
    total_images = len(result.scalars().all())
    
    # Count reviewed by this expert
    query = select(ExpertAssessment).where(
        ExpertAssessment.expert_id == current_user.id
    )
    result = await db.execute(query)
    reviewed = len(result.scalars().all())
    
    return {
        "total_images": total_images,
        "reviewed": reviewed,
        "remaining": max(0, total_images - reviewed),
        "progress_percent": round((reviewed / total_images * 100) if total_images > 0 else 0, 1),
    }
