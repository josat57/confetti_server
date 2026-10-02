"""
Visual AI Service
Handles image generation, analysis, and visual content creation for events
"""

import json
import logging
import os
import time
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


class VisionUnavailableError(Exception):
    """No vision-capable model is configured, or every provider failed."""


# Output contract for /ai/analyze-image (unchanged field names for Node)
IMAGE_ANALYSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "analysis": {"type": "object", "properties": {
            "composition": {"type": "object", "properties": {
                "balance": {"type": "string"}, "focal_point": {"type": "string"}, "notes": {"type": "string"}}},
            "color_analysis": {"type": "object", "properties": {
                "dominant_colors": {"type": "array", "items": {"type": "string"}, "description": "hex codes"},
                "color_harmony": {"type": "string"}, "mood": {"type": "string"}}},
            "style_assessment": {"type": "object", "properties": {
                "style": {"type": "string"}, "formality": {"type": "string"}, "appropriateness": {"type": "string"}}},
            "technical_quality": {"type": "object", "properties": {
                "resolution": {"type": "string"}, "lighting": {"type": "string"}, "clarity": {"type": "string"}}},
            "event_suitability": {"type": "object", "properties": {
                "score": {"type": "number", "description": "0-1"},
                "strengths": {"type": "array", "items": {"type": "string"}},
                "improvements": {"type": "array", "items": {"type": "string"}}}},
        }},
        "detected_elements": {"type": "array", "items": {"type": "string"}},
        "recommendations": {"type": "array", "items": {"type": "string"}},
        "overall_score": {"type": "number", "description": "0-1 suitability for the event"},
    },
    "required": ["analysis", "detected_elements", "recommendations", "overall_score"],
}

VISION_SYSTEM_PROMPT = (
    "You are an event design expert reviewing a photo (venue, decor, setup or inspiration) "
    "for an event planning platform. Describe only what is actually visible. "
    "Scores are 0-1. Colors are hex codes."
)

class VisualAIService:
    """
    Provides AI-powered visual content generation and analysis for event planning
    """
    
    def __init__(self):
        self.image_models = {
            'stable-diffusion': {'available': False, 'fallback': True},
            'dall-e-3': {'available': False, 'fallback': True},
        }
        
        # Fallback image URLs (placeholder images)
        self.fallback_images = {
            'wedding': 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800',
            'corporate': 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800',
            'birthday': 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800',
            'conference': 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=800',
            'default': 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800'
        }
        
        # Color palettes for different themes
        self.color_palettes = {
            'elegant': ['#F8F9FA', '#E9ECEF', '#6C757D', '#495057', '#212529'],
            'modern': ['#FFFFFF', '#F8F9FA', '#007BFF', '#28A745', '#DC3545'],
            'classic': ['#FFF8DC', '#F5F5DC', '#DEB887', '#8B4513', '#A0522D'],
            'rustic': ['#DEB887', '#D2B48C', '#CD853F', '#8B4513', '#A0522D'],
            'romantic': ['#FFE4E1', '#FFC0CB', '#FF69B4', '#DC143C', '#8B0000'],
            'professional': ['#F8F9FA', '#E9ECEF', '#495057', '#007BFF', '#28A745'],
            'festive': ['#FFD700', '#FF6347', '#32CD32', '#FF1493', '#9370DB']
        }
    
    def generate_image(self, prompt: str, model: str = 'stable-diffusion',
                      style: str = 'photorealistic', aspect_ratio: str = '16:9',
                      quality: str = 'high') -> Dict[str, Any]:
        """
        Generate an image with OpenAI (OPENAI_API_KEY; model OPENAI_IMAGE_MODEL,
        default dall-e-3). Without a key, or if generation fails, a curated stock
        photo matching the event type is returned and marked as such
        (metadata.generated = False).
        """
        started = time.time()
        event_type = self._detect_event_type(prompt)
        detected_style = self._analyze_style_from_prompt(prompt, style)
        prompt_analysis = {
            'event_type': event_type,
            'style_elements': self._extract_style_elements(prompt),
            'color_hints': self._extract_color_hints(prompt)
        }
        params = {'style': style, 'aspect_ratio': aspect_ratio, 'quality': quality}

        from services.ai_orchestrator import _get_openai

        generated_url = generated_b64 = None
        image_model = os.environ.get('OPENAI_IMAGE_MODEL') or 'dall-e-3'
        is_gpt_image = image_model.startswith('gpt-image')
        error = None
        client = _get_openai()
        if client:
            try:
                landscape = aspect_ratio in ('16:9', 'landscape')
                portrait = aspect_ratio in ('9:16', 'portrait')
                if is_gpt_image:
                    size = '1536x1024' if landscape else '1024x1536' if portrait else '1024x1024'
                    image_quality = 'high' if quality == 'high' else 'medium'
                else:
                    size = '1792x1024' if landscape else '1024x1792' if portrait else '1024x1024'
                    image_quality = 'hd' if quality == 'high' else 'standard'
                result = client.images.generate(
                    model=image_model,
                    prompt=f"{prompt}. Style: {style}."[:3900],
                    size=size,
                    quality=image_quality,
                    n=1,
                )
                # gpt-image-* returns base64; dall-e returns a URL that expires after ~1 hour
                generated_url = result.data[0].url
                generated_b64 = getattr(result.data[0], 'b64_json', None)
            except Exception as e:  # fall back to stock imagery
                error = str(e)
                logger.error(f"Image generation failed, using stock image: {e}")

        elapsed_ms = int((time.time() - started) * 1000)
        if generated_url or generated_b64:
            logger.info(f"Generated image for {event_type} event with {style} style ({image_model})")
            return {
                'image_url': generated_url,
                'image_b64': generated_b64 if not generated_url else None,
                'image_mime': 'image/png',
                'detected_style': detected_style,
                'confidence': 0.9,
                'processing_time': elapsed_ms,
                'metadata': {
                    'model': image_model,
                    'generated': True,
                    # The caller must persist the image; provider URLs are temporary
                    'temporary_url': bool(generated_url),
                    'prompt_analysis': prompt_analysis,
                    'generation_params': params,
                }
            }

        return {
            'image_url': self.fallback_images.get(event_type, self.fallback_images['default']),
            'detected_style': detected_style,
            'confidence': 0.5,
            'processing_time': elapsed_ms,
            'metadata': {
                'model': 'stock',
                'generated': False,
                'note': 'Stock photo for this event type (set OPENAI_API_KEY to generate images)'
                        if not error else f'Generation failed, stock photo returned: {error[:200]}',
                'prompt_analysis': prompt_analysis,
                'generation_params': params,
            }
        }

    def analyze_image(self, image_url: str, prompt: str = None,
                     model: str = 'gpt-4o', analysis_type: str = 'general') -> Dict[str, Any]:
        """
        Analyze an image with a vision model: OpenAI first (or Claude first when
        model starts with "claude"), falling back to the other. Raises
        VisionUnavailableError if no provider is configured or all fail —
        this never returns made-up analysis.
        """
        from services.ai_orchestrator import _get_openai, _get_anthropic, OPENAI_MODEL, CLAUDE_MODEL

        if not isinstance(image_url, str) or not image_url.startswith(("https://", "http://")):
            raise ValueError("image_url must be an http(s) URL")

        instruction = (
            f"Analysis type: {analysis_type}.\n"
            + (f"Context from the planner: {prompt}\n" if prompt else "")
            + "Assess the image for event planning."
        )

        providers = [("openai", _get_openai), ("anthropic", _get_anthropic)]
        if str(model).lower().startswith("claude"):
            providers.reverse()

        started = time.time()
        errors = []
        for name, get_client in providers:
            client = get_client()
            if not client:
                continue
            try:
                if name == "openai":
                    data, used = self._analyze_with_openai(client, OPENAI_MODEL, image_url, instruction), OPENAI_MODEL
                else:
                    data, used = self._analyze_with_claude(client, CLAUDE_MODEL, image_url, instruction), CLAUDE_MODEL
            except Exception as e:
                logger.error(f"Image analysis via {name} failed: {e}")
                errors.append(f"{name}: {str(e)[:120]}")
                continue

            score = data.get("overall_score")
            return {
                'analysis': data.get('analysis', {}),
                'confidence': 0.85,
                'detected_elements': data.get('detected_elements', []),
                'recommendations': data.get('recommendations', []),
                'overall_score': score if isinstance(score, (int, float)) else None,
                'metadata': {
                    'model': used,
                    'analysis_type': analysis_type,
                    'processing_time': int((time.time() - started) * 1000),
                },
            }

        raise VisionUnavailableError(
            "Image analysis unavailable: " + ("; ".join(errors) if errors else
                                              "no vision model configured (set OPENAI_API_KEY or ANTHROPIC_API_KEY)")
        )

    def _analyze_with_openai(self, client, model: str, image_url: str, instruction: str) -> Dict:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": VISION_SYSTEM_PROMPT
                    + " Reply with JSON matching this schema: " + json.dumps(IMAGE_ANALYSIS_SCHEMA)},
                {"role": "user", "content": [
                    {"type": "text", "text": instruction},
                    {"type": "image_url", "image_url": {"url": image_url}},
                ]},
            ],
            response_format={"type": "json_object"},
            max_tokens=1500,
            temperature=0.2,
        )
        return json.loads(response.choices[0].message.content)

    def _analyze_with_claude(self, client, model: str, image_url: str, instruction: str) -> Dict:
        response = client.messages.create(
            model=model,
            max_tokens=1500,
            temperature=0.2,
            system=VISION_SYSTEM_PROMPT,
            tools=[{"name": "submit_image_analysis", "description": "Submit the image analysis.",
                    "input_schema": IMAGE_ANALYSIS_SCHEMA}],
            tool_choice={"type": "tool", "name": "submit_image_analysis"},
            messages=[{"role": "user", "content": [
                {"type": "image", "source": {"type": "url", "url": image_url}},
                {"type": "text", "text": instruction},
            ]}],
        )
        tool_use = next((b for b in response.content if b.type == "tool_use"), None)
        if tool_use is None:
            raise ValueError(f"no tool call (stop_reason={response.stop_reason})")
        return dict(tool_use.input)

    def generate_mood_board(self, theme: str, event_type: str, color_preferences: List[str] = None) -> Dict[str, Any]:
        """
        Generate mood board for event planning
        """
        try:
            # Get color palette
            colors = color_preferences or self.color_palettes.get(theme, self.color_palettes['classic'])
            
            # Generate mood board elements
            mood_board = {
                'theme': theme,
                'event_type': event_type,
                'color_palette': colors[:5],  # Limit to 5 colors
                'style_elements': self._get_style_elements(theme, event_type),
                'inspiration_images': self._get_inspiration_images(theme, event_type),
                'typography_suggestions': self._get_typography_suggestions(theme),
                'texture_patterns': self._get_texture_patterns(theme),
                'lighting_suggestions': self._get_lighting_suggestions(theme, event_type),
                'layout_concepts': self._get_layout_concepts(event_type),
                'confidence': 0.85,
                'generated_at': time.time()
            }
            
            logger.info(f"Generated mood board for {theme} {event_type}")
            return mood_board
            
        except Exception as e:
            logger.error(f"Mood board generation failed: {e}")
            return self._get_fallback_mood_board(theme, event_type)
    
    def generate_color_palette(self, base_color: str = None, theme: str = 'modern', 
                              palette_size: int = 5) -> Dict[str, Any]:
        """
        Generate color palette for events
        """
        try:
            if base_color:
                # Generate palette based on base color
                palette = self._generate_palette_from_base(base_color, palette_size)
            else:
                # Use theme-based palette
                palette = self.color_palettes.get(theme, self.color_palettes['modern'])[:palette_size]
            
            return {
                'colors': palette,
                'theme': theme,
                'base_color': base_color,
                'palette_info': {
                    'primary': palette[0] if palette else '#FFFFFF',
                    'secondary': palette[1] if len(palette) > 1 else '#F8F9FA',
                    'accent': palette[2] if len(palette) > 2 else '#007BFF',
                    'neutral': palette[3] if len(palette) > 3 else '#6C757D',
                    'dark': palette[4] if len(palette) > 4 else '#212529'
                },
                'usage_suggestions': self._get_color_usage_suggestions(palette, theme),
                'accessibility_score': self._calculate_accessibility_score(palette),
                'generated_at': time.time()
            }
            
        except Exception as e:
            logger.error(f"Color palette generation failed: {e}")
            return self._get_fallback_color_palette(theme)
    
    def _detect_event_type(self, prompt: str) -> str:
        """Detect event type from prompt"""
        prompt_lower = prompt.lower()
        
        if any(word in prompt_lower for word in ['wedding', 'marriage', 'bride', 'groom']):
            return 'wedding'
        elif any(word in prompt_lower for word in ['corporate', 'business', 'conference', 'meeting']):
            return 'corporate'
        elif any(word in prompt_lower for word in ['birthday', 'party', 'celebration']):
            return 'birthday'
        elif any(word in prompt_lower for word in ['conference', 'seminar', 'workshop']):
            return 'conference'
        else:
            return 'default'
    
    def _analyze_style_from_prompt(self, prompt: str, requested_style: str) -> str:
        """Analyze style from prompt"""
        prompt_lower = prompt.lower()
        
        if 'elegant' in prompt_lower or 'sophisticated' in prompt_lower:
            return 'elegant'
        elif 'modern' in prompt_lower or 'contemporary' in prompt_lower:
            return 'modern'
        elif 'rustic' in prompt_lower or 'vintage' in prompt_lower:
            return 'rustic'
        elif 'romantic' in prompt_lower or 'intimate' in prompt_lower:
            return 'romantic'
        else:
            return requested_style
    
    def _extract_style_elements(self, prompt: str) -> List[str]:
        """Extract style elements from prompt"""
        elements = []
        prompt_lower = prompt.lower()
        
        style_keywords = {
            'lighting': ['ambient', 'soft', 'warm', 'bright', 'dramatic'],
            'decoration': ['flowers', 'candles', 'balloons', 'banners'],
            'furniture': ['tables', 'chairs', 'lounge', 'bar'],
            'atmosphere': ['intimate', 'festive', 'professional', 'casual']
        }
        
        for category, keywords in style_keywords.items():
            for keyword in keywords:
                if keyword in prompt_lower:
                    elements.append(f"{category}: {keyword}")
        
        return elements[:5]  # Limit to 5 elements
    
    def _extract_color_hints(self, prompt: str) -> List[str]:
        """Extract color hints from prompt"""
        colors = []
        prompt_lower = prompt.lower()
        
        color_keywords = ['red', 'blue', 'green', 'yellow', 'purple', 'pink', 'orange', 
                         'white', 'black', 'gold', 'silver', 'rose', 'navy', 'burgundy']
        
        for color in color_keywords:
            if color in prompt_lower:
                colors.append(color)
        
        return colors[:3]  # Limit to 3 colors
    
    def _get_style_elements(self, theme: str, event_type: str) -> List[str]:
        """Get style elements for theme and event type"""
        elements = {
            'elegant': ['crystal chandeliers', 'silk draping', 'gold accents', 'fine china'],
            'modern': ['clean lines', 'geometric shapes', 'LED lighting', 'minimalist decor'],
            'classic': ['traditional elements', 'warm wood', 'brass fixtures', 'timeless design'],
            'rustic': ['natural wood', 'burlap textures', 'mason jars', 'wildflowers'],
            'romantic': ['soft fabrics', 'candles', 'rose petals', 'fairy lights']
        }
        
        return elements.get(theme, elements['modern'])[:4]
    
    def _get_inspiration_images(self, theme: str, event_type: str) -> List[str]:
        """Get inspiration images for mood board"""
        base_images = [
            'https://images.unsplash.com/photo-1519741497674-611481863552?w=400',
            'https://images.unsplash.com/photo-1511578314322-379afb476865?w=400',
            'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400',
            'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=400'
        ]
        
        return base_images[:3]  # Return 3 inspiration images
    
    def _get_typography_suggestions(self, theme: str) -> Dict[str, str]:
        """Get typography suggestions for theme"""
        typography = {
            'elegant': {'primary': 'Playfair Display', 'secondary': 'Source Sans Pro'},
            'modern': {'primary': 'Montserrat', 'secondary': 'Open Sans'},
            'classic': {'primary': 'Times New Roman', 'secondary': 'Georgia'},
            'rustic': {'primary': 'Amatic SC', 'secondary': 'Lato'},
            'romantic': {'primary': 'Dancing Script', 'secondary': 'Lora'}
        }
        
        return typography.get(theme, typography['modern'])
    
    def _get_texture_patterns(self, theme: str) -> List[str]:
        """Get texture patterns for theme"""
        patterns = {
            'elegant': ['silk', 'velvet', 'satin', 'lace'],
            'modern': ['smooth', 'matte', 'glossy', 'metallic'],
            'classic': ['leather', 'wood grain', 'marble', 'fabric'],
            'rustic': ['burlap', 'wood', 'stone', 'natural fiber'],
            'romantic': ['chiffon', 'tulle', 'lace', 'soft cotton']
        }
        
        return patterns.get(theme, patterns['modern'])[:3]
    
    def _get_lighting_suggestions(self, theme: str, event_type: str) -> List[str]:
        """Get lighting suggestions"""
        suggestions = {
            'elegant': ['crystal chandeliers', 'warm ambient lighting', 'candles'],
            'modern': ['LED strips', 'spotlights', 'color-changing lights'],
            'classic': ['traditional fixtures', 'warm white lights', 'table lamps'],
            'rustic': ['string lights', 'lanterns', 'natural light'],
            'romantic': ['fairy lights', 'candles', 'soft warm lighting']
        }
        
        return suggestions.get(theme, suggestions['modern'])[:3]
    
    def _get_layout_concepts(self, event_type: str) -> List[str]:
        """Get layout concepts for event type"""
        layouts = {
            'wedding': ['ceremony seating', 'reception tables', 'dance floor', 'photo area'],
            'corporate': ['presentation area', 'networking space', 'registration desk'],
            'birthday': ['party area', 'gift table', 'entertainment zone'],
            'conference': ['auditorium seating', 'breakout rooms', 'exhibition area']
        }
        
        return layouts.get(event_type, layouts['corporate'])[:3]
    
    def _generate_palette_from_base(self, base_color: str, size: int) -> List[str]:
        """Generate color palette from base color"""
        # Simplified palette generation
        palettes = {
            '#FF0000': ['#FF0000', '#FF6B6B', '#FFE4E1', '#8B0000', '#FFFFFF'],
            '#0000FF': ['#0000FF', '#4169E1', '#E6F3FF', '#000080', '#FFFFFF'],
            '#00FF00': ['#00FF00', '#32CD32', '#F0FFF0', '#006400', '#FFFFFF']
        }
        
        return palettes.get(base_color, self.color_palettes['modern'])[:size]
    
    def _get_color_usage_suggestions(self, palette: List[str], theme: str) -> Dict[str, str]:
        """Get color usage suggestions"""
        return {
            'primary': 'Use for main branding and key elements',
            'secondary': 'Use for supporting elements and backgrounds',
            'accent': 'Use sparingly for highlights and call-to-action',
            'neutral': 'Use for text and subtle elements',
            'dark': 'Use for contrast and emphasis'
        }
    
    def _calculate_accessibility_score(self, palette: List[str]) -> float:
        """Calculate accessibility score for color palette"""
        # Simplified accessibility calculation
        return 0.85  # Assume good accessibility
    
    def _get_fallback_mood_board(self, theme: str, event_type: str) -> Dict[str, Any]:
        """Get fallback mood board"""
        return {
            'theme': theme,
            'event_type': event_type,
            'color_palette': self.color_palettes.get(theme, self.color_palettes['modern'])[:5],
            'style_elements': ['basic elements'],
            'inspiration_images': [self.fallback_images['default']],
            'confidence': 0.6,
            'generated_at': time.time(),
            'note': 'Using fallback mood board generation'
        }
    
    def _get_fallback_color_palette(self, theme: str) -> Dict[str, Any]:
        """Get fallback color palette"""
        palette = self.color_palettes.get(theme, self.color_palettes['modern'])
        
        return {
            'colors': palette,
            'theme': theme,
            'palette_info': {
                'primary': palette[0],
                'secondary': palette[1],
                'accent': palette[2],
                'neutral': palette[3],
                'dark': palette[4]
            },
            'usage_suggestions': self._get_color_usage_suggestions(palette, theme),
            'accessibility_score': 0.8,
            'generated_at': time.time(),
            'note': 'Using fallback color palette'
        }
    
    def health_check(self) -> str:
        """Generation and analysis both need an external model."""
        if os.environ.get('OPENAI_API_KEY') or os.environ.get('ANTHROPIC_API_KEY'):
            return 'operational'
        return 'degraded'
