"""
Diagnostic router for public image analysis.
"""

import os
import uuid
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.image import Image, ImageType
from app.models.measurement import ClinicalMeasurement
from app.models.inference import AIInference, ModelType, PredictionClass
from app.schemas.diagnostic import (
    MeasurementInput,
    DiagnosticResponse,
    InferenceResult,
    SegmentationResult,
    IOTNResult as IOTNResultSchema,
)
from app.services.model_service import ModelService
from app.services.iotn_rule_engine import IOTNRuleEngine

router = APIRouter()
settings = get_settings()


@router.post("/analyze", response_model=DiagnosticResponse)
async def analyze_image(
    file: UploadFile = File(...),
    image_type: Optional[str] = Form(None),
    overjet_mm: Optional[float] = Form(None),
    reverse_overjet_mm: Optional[float] = Form(None),
    overbite_mm: Optional[float] = Form(None),
    displacement_mm: Optional[float] = Form(None),
    crossbite_displacement_mm: Optional[float] = Form(None),
    open_bite_mm: Optional[float] = Form(None),
    lips_competent: Optional[bool] = Form(None),
    gingival_contact: Optional[bool] = Form(None),
    gingival_trauma: Optional[bool] = Form(None),
    speech_difficulty: Optional[bool] = Form(None),
    masticatory_difficulty: Optional[bool] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Analyze a dental image with AI models and calculate IOTN grade.
    
    This endpoint accepts an image file and optional clinical measurements,
    runs all classification models, and returns combined results with IOTN grade.
    """
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type {file.content_type} not allowed. Use: {allowed_types}",
        )
    
    # Generate unique filename
    file_ext = file.filename.split(".")[-1] if file.filename else "jpg"
    unique_filename = f"{uuid.uuid4()}.{file_ext}"
    file_path = os.path.join(settings.upload_dir, "images", unique_filename)
    
    # Save uploaded file
    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)
    
    # Parse image type
    parsed_image_type = None
    if image_type:
        try:
            parsed_image_type = ImageType(image_type.lower())
        except ValueError:
            pass
    
    # Create image record
    image = Image(
        filename=unique_filename,
        original_filename=file.filename or "unknown",
        file_path=file_path,
        file_size=len(contents),
        mime_type=file.content_type,
        image_type=parsed_image_type,
        is_processed=False,
    )
    db.add(image)
    await db.flush()
    
    # Save clinical measurements
    measurement = ClinicalMeasurement(
        image_id=image.id,
        overjet_mm=overjet_mm,
        reverse_overjet_mm=reverse_overjet_mm,
        overbite_mm=overbite_mm,
        displacement_mm=displacement_mm,
        crossbite_displacement_mm=crossbite_displacement_mm,
        open_bite_mm=open_bite_mm,
        lips_competent=lips_competent,
        gingival_contact=gingival_contact,
        gingival_trauma=gingival_trauma,
        speech_difficulty=speech_difficulty,
        masticatory_difficulty=masticatory_difficulty,
    )
    db.add(measurement)
    
    # Run AI models
    model_service = ModelService()
    classification_results = await model_service.run_all_classifications(file_path)
    
    # Save inference results
    inference_records = []
    for model_name, result in classification_results.items():
        inference = AIInference(
            image_id=image.id,
            model_name=ModelType(model_name),
            predicted_class=result.get("predicted_class"),
            confidence_score=result.get("confidence", 0.0),
            inference_time_ms=result.get("inference_time_ms", 0),
            raw_output=result.get("raw_output"),
        )
        db.add(inference)
        inference_records.append(inference)
    
    # Run segmentation if occlusal image
    segmentation_result = None
    if parsed_image_type == ImageType.OCCLUSAL:
        mask_filename = f"{uuid.uuid4()}_mask.png"
        mask_path = os.path.join(settings.upload_dir, "masks", mask_filename)
        
        seg_result = await model_service.run_segmentation(file_path, mask_path)
        
        if seg_result.get("mask_path"):
            segmentation_inference = AIInference(
                image_id=image.id,
                model_name=ModelType.SEGMENTATION,
                segmentation_mask_path=mask_path,
                segmentation_data=seg_result.get("segmentation_data"),
                inference_time_ms=seg_result.get("inference_time_ms", 0),
            )
            db.add(segmentation_inference)
            
            segmentation_result = SegmentationResult(
                mask_url=f"/uploads/masks/{mask_filename}",
                tooth_count=seg_result.get("tooth_count", 0),
            )
    
    # Calculate IOTN grade
    iotn_result = IOTNRuleEngine.calculate_final_grade(
        overjet_mm=overjet_mm,
        reverse_overjet_mm=reverse_overjet_mm,
        overbite_mm=overbite_mm,
        displacement_mm=displacement_mm,
        crossbite_displacement_mm=crossbite_displacement_mm,
        open_bite_mm=open_bite_mm,
        lips_competent=lips_competent,
        gingival_contact=gingival_contact,
        gingival_trauma=gingival_trauma,
        speech_difficulty=speech_difficulty,
        masticatory_difficulty=masticatory_difficulty,
    )
    
    # Update measurement with calculated grade
    measurement.calculated_iotn_grade = iotn_result.grade
    
    # Mark image as processed
    image.is_processed = True
    
    # Build response
    classifications = [
        InferenceResult(
            model_name=model_name,
            detected=result.get("predicted_class") == PredictionClass.PRESENT,
            confidence=result.get("confidence", 0.0),
        )
        for model_name, result in classification_results.items()
        if result.get("predicted_class") is not None
    ]
    
    return DiagnosticResponse(
        id=image.id,
        image_url=f"/uploads/images/{unique_filename}",
        image_type=parsed_image_type,
        classifications=classifications,
        segmentation=segmentation_result,
        iotn=IOTNResultSchema(
            grade=iotn_result.grade,
            grade_description=iotn_result.grade_description,
            determining_factor=iotn_result.determining_factor,
            treatment_need=iotn_result.treatment_need,
        ),
        measurements=MeasurementInput(
            overjet_mm=overjet_mm,
            reverse_overjet_mm=reverse_overjet_mm,
            overbite_mm=overbite_mm,
            displacement_mm=displacement_mm,
            crossbite_displacement_mm=crossbite_displacement_mm,
            open_bite_mm=open_bite_mm,
            lips_competent=lips_competent,
            gingival_contact=gingival_contact,
            gingival_trauma=gingival_trauma,
            speech_difficulty=speech_difficulty,
            masticatory_difficulty=masticatory_difficulty,
        ),
        processed_at=datetime.utcnow(),
    )


@router.get("/result/{image_id}", response_model=DiagnosticResponse)
async def get_result(
    image_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get diagnostic result by image ID."""
    # Fetch image
    result = await db.execute(
        select(Image).where(Image.id == image_id)
    )
    image = result.scalar_one_or_none()
    
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found",
        )
    
    # Fetch measurements
    result = await db.execute(
        select(ClinicalMeasurement).where(ClinicalMeasurement.image_id == image_id)
    )
    measurement = result.scalar_one_or_none()
    
    # Fetch inferences
    result = await db.execute(
        select(AIInference).where(AIInference.image_id == image_id)
    )
    inferences = result.scalars().all()
    
    # Build classifications
    classifications = []
    segmentation = None
    
    for inf in inferences:
        if inf.model_name == ModelType.SEGMENTATION:
            if inf.segmentation_mask_path:
                mask_filename = os.path.basename(inf.segmentation_mask_path)
                segmentation = SegmentationResult(
                    mask_url=f"/uploads/masks/{mask_filename}",
                    tooth_count=inf.segmentation_data.get("num_segments", 0) if inf.segmentation_data else 0,
                )
        else:
            classifications.append(
                InferenceResult(
                    model_name=inf.model_name.value,
                    detected=inf.predicted_class == PredictionClass.PRESENT,
                    confidence=inf.confidence_score or 0.0,
                )
            )
    
    # Build measurements
    measurements = MeasurementInput(
        overjet_mm=measurement.overjet_mm if measurement else None,
        reverse_overjet_mm=measurement.reverse_overjet_mm if measurement else None,
        overbite_mm=measurement.overbite_mm if measurement else None,
        displacement_mm=measurement.displacement_mm if measurement else None,
        crossbite_displacement_mm=measurement.crossbite_displacement_mm if measurement else None,
        open_bite_mm=measurement.open_bite_mm if measurement else None,
        lips_competent=measurement.lips_competent if measurement else None,
        gingival_contact=measurement.gingival_contact if measurement else None,
        gingival_trauma=measurement.gingival_trauma if measurement else None,
        speech_difficulty=measurement.speech_difficulty if measurement else None,
        masticatory_difficulty=measurement.masticatory_difficulty if measurement else None,
    )
    
    # Calculate IOTN (or use stored)
    iotn_grade = measurement.calculated_iotn_grade if measurement else 1
    iotn_result = IOTNRuleEngine.calculate_final_grade(
        overjet_mm=measurement.overjet_mm if measurement else None,
        reverse_overjet_mm=measurement.reverse_overjet_mm if measurement else None,
        overbite_mm=measurement.overbite_mm if measurement else None,
        displacement_mm=measurement.displacement_mm if measurement else None,
        crossbite_displacement_mm=measurement.crossbite_displacement_mm if measurement else None,
        open_bite_mm=measurement.open_bite_mm if measurement else None,
        lips_competent=measurement.lips_competent if measurement else None,
        gingival_contact=measurement.gingival_contact if measurement else None,
        gingival_trauma=measurement.gingival_trauma if measurement else None,
        speech_difficulty=measurement.speech_difficulty if measurement else None,
        masticatory_difficulty=measurement.masticatory_difficulty if measurement else None,
    )
    
    return DiagnosticResponse(
        id=image.id,
        image_url=f"/uploads/images/{image.filename}",
        image_type=image.image_type,
        classifications=classifications,
        segmentation=segmentation,
        iotn=IOTNResultSchema(
            grade=iotn_result.grade,
            grade_description=iotn_result.grade_description,
            determining_factor=iotn_result.determining_factor,
            treatment_need=iotn_result.treatment_need,
        ),
        measurements=measurements,
        processed_at=image.uploaded_at,
    )
