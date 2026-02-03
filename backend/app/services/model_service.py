"""
AI Model Service for loading and running inference.
"""

import os
import time
from typing import Optional, Dict, List, Any
from pathlib import Path

import torch
import numpy as np
from PIL import Image
import cv2

from app.config import get_settings
from app.models.inference import ModelType, PredictionClass

settings = get_settings()


class ModelService:
    """
    Service for loading and running AI models.
    
    Supports 5 classification models and 1 segmentation model.
    """
    
    _instance = None
    _models: Dict[str, Any] = {}
    _device: str = "cpu"
    _loaded: bool = False
    
    def __new__(cls):
        """Singleton pattern for model service."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    async def load_models(self) -> None:
        """Load all AI models from disk."""
        if self._loaded:
            return
        
        # Determine device
        if settings.device == "cuda" and torch.cuda.is_available():
            self._device = "cuda"
            print(f"🎮 Using GPU: {torch.cuda.get_device_name(0)}")
        else:
            self._device = "cpu"
            print("💻 Using CPU for inference")
        
        models_dir = Path(settings.models_dir)
        
        # Model files mapping
        model_files = {
            ModelType.CROSSBITE: "crossbite.pt",
            ModelType.OVERBITE: "overbite.pt",
            ModelType.OPENBITE: "openbite.pt",
            ModelType.DISPLACEMENT: "displacement.pt",
            ModelType.OVERJET: "overjet.pt",
            ModelType.SEGMENTATION: "segmentation.pt",
        }
        
        # Load each model
        for model_type, filename in model_files.items():
            model_path = models_dir / filename
            
            if model_path.exists():
                try:
                    from ultralytics import YOLO
                    model = YOLO(str(model_path))
                    self._models[model_type] = model
                    print(f"  ✅ Loaded {model_type.value} model")
                except Exception as e:
                    print(f"  ⚠️ Failed to load {model_type.value}: {e}")
            else:
                print(f"  ⚠️ Model not found: {filename}")
        
        self._loaded = True
    
    def is_loaded(self) -> bool:
        """Check if models are loaded."""
        return self._loaded
    
    def get_loaded_models(self) -> List[str]:
        """Get list of loaded model names."""
        return [mt.value for mt in self._models.keys()]
    
    async def run_classification(
        self,
        image_path: str,
        model_type: ModelType,
    ) -> Dict[str, Any]:
        """
        Run classification inference on an image.
        
        Returns:
            Dict with predicted_class, confidence, and inference_time_ms
        """
        if model_type not in self._models:
            return {
                "predicted_class": None,
                "confidence": 0.0,
                "inference_time_ms": 0,
                "error": f"Model {model_type.value} not loaded",
            }
        
        model = self._models[model_type]
        
        start_time = time.time()
        
        try:
            # Run inference
            results = model(image_path, device=self._device, verbose=False)
            
            inference_time_ms = int((time.time() - start_time) * 1000)
            
            if results and len(results) > 0:
                result = results[0]
                
                # Get prediction
                if hasattr(result, 'probs') and result.probs is not None:
                    # Classification model output
                    probs = result.probs
                    top_class_idx = probs.top1
                    confidence = float(probs.top1conf)
                    
                    # Map class index to presence/absence
                    # Assuming class 0 = absent, class 1 = present
                    predicted_class = PredictionClass.PRESENT if top_class_idx == 1 else PredictionClass.ABSENT
                    
                    return {
                        "predicted_class": predicted_class,
                        "confidence": confidence,
                        "inference_time_ms": inference_time_ms,
                        "raw_output": {
                            "class_idx": top_class_idx,
                            "class_names": result.names if hasattr(result, 'names') else None,
                        },
                    }
                else:
                    # Detection model - check if any detections
                    boxes = result.boxes if hasattr(result, 'boxes') else None
                    if boxes is not None and len(boxes) > 0:
                        confidence = float(boxes.conf.max()) if len(boxes.conf) > 0 else 0.0
                        return {
                            "predicted_class": PredictionClass.PRESENT,
                            "confidence": confidence,
                            "inference_time_ms": inference_time_ms,
                            "raw_output": {
                                "num_detections": len(boxes),
                            },
                        }
                    else:
                        return {
                            "predicted_class": PredictionClass.ABSENT,
                            "confidence": 1.0,
                            "inference_time_ms": inference_time_ms,
                        }
            
            return {
                "predicted_class": PredictionClass.ABSENT,
                "confidence": 0.0,
                "inference_time_ms": inference_time_ms,
            }
            
        except Exception as e:
            return {
                "predicted_class": None,
                "confidence": 0.0,
                "inference_time_ms": 0,
                "error": str(e),
            }
    
    async def run_segmentation(
        self,
        image_path: str,
        output_mask_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Run segmentation inference on an image.
        
        Returns:
            Dict with mask_path, tooth_count, and inference_time_ms
        """
        if ModelType.SEGMENTATION not in self._models:
            return {
                "mask_path": None,
                "tooth_count": 0,
                "inference_time_ms": 0,
                "error": "Segmentation model not loaded",
            }
        
        model = self._models[ModelType.SEGMENTATION]
        
        start_time = time.time()
        
        try:
            # Run inference
            results = model(image_path, device=self._device, verbose=False)
            
            inference_time_ms = int((time.time() - start_time) * 1000)
            
            if results and len(results) > 0:
                result = results[0]
                
                if hasattr(result, 'masks') and result.masks is not None:
                    masks = result.masks.data.cpu().numpy()
                    
                    # Count unique segments (teeth)
                    tooth_count = len(masks)
                    
                    # Create colored mask overlay
                    if output_mask_path:
                        orig_img = cv2.imread(image_path)
                        mask_overlay = self._create_mask_overlay(orig_img, masks)
                        cv2.imwrite(output_mask_path, mask_overlay)
                    
                    return {
                        "mask_path": output_mask_path,
                        "tooth_count": tooth_count,
                        "inference_time_ms": inference_time_ms,
                        "segmentation_data": {
                            "num_segments": tooth_count,
                        },
                    }
            
            return {
                "mask_path": None,
                "tooth_count": 0,
                "inference_time_ms": inference_time_ms,
            }
            
        except Exception as e:
            return {
                "mask_path": None,
                "tooth_count": 0,
                "inference_time_ms": 0,
                "error": str(e),
            }
    
    def _create_mask_overlay(
        self,
        image: np.ndarray,
        masks: np.ndarray,
        alpha: float = 0.5,
    ) -> np.ndarray:
        """Create a colored mask overlay on the original image."""
        overlay = image.copy()
        
        # Generate distinct colors for each segment
        colors = self._generate_colors(len(masks))
        
        for i, mask in enumerate(masks):
            # Resize mask to image size if needed
            if mask.shape != image.shape[:2]:
                mask = cv2.resize(
                    mask.astype(np.uint8),
                    (image.shape[1], image.shape[0]),
                    interpolation=cv2.INTER_NEAREST,
                )
            
            # Apply color to mask
            color = colors[i]
            mask_bool = mask > 0.5
            overlay[mask_bool] = (
                overlay[mask_bool] * (1 - alpha) +
                np.array(color) * alpha
            ).astype(np.uint8)
        
        return overlay
    
    @staticmethod
    def _generate_colors(n: int) -> List[tuple]:
        """Generate n distinct colors for visualization."""
        colors = []
        for i in range(n):
            hue = int(180 * i / n)
            color = cv2.cvtColor(
                np.uint8([[[hue, 255, 255]]]),
                cv2.COLOR_HSV2BGR
            )[0][0]
            colors.append(tuple(int(c) for c in color))
        return colors
    
    async def run_all_classifications(
        self,
        image_path: str,
    ) -> Dict[str, Dict[str, Any]]:
        """
        Run all 5 classification models on an image.
        
        Returns a dict mapping model_type to results.
        """
        results = {}
        
        classification_models = [
            ModelType.CROSSBITE,
            ModelType.OVERBITE,
            ModelType.OPENBITE,
            ModelType.DISPLACEMENT,
            ModelType.OVERJET,
        ]
        
        for model_type in classification_models:
            result = await self.run_classification(image_path, model_type)
            results[model_type.value] = result
        
        return results
