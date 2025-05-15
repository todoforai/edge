#!/usr/bin/env python3
"""
Script to add "Edge" text to the bottom right corner of the icon.
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

def add_edge_text(icon_path):
    try:
        # Open the image
        img = Image.open(icon_path)
        
        # Create a drawing context
        draw = ImageDraw.Draw(img)
        
        # Try to load a nice font, fall back to default if not available
        try:
            # Try to find a system font - increase font size by 25%
            font_size = int(img.width * 0.19)  # Increased from 0.15 to 0.19
            
            # Try different fonts based on platform
            font_paths = [
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",  # Linux
                "/System/Library/Fonts/SFCompact-Bold.otf",  # macOS
                "C:\\Windows\\Fonts\\Arial.ttf",  # Windows
                # Add more potential font paths here
            ]
            
            font = None
            for font_path in font_paths:
                if os.path.exists(font_path):
                    font = ImageFont.truetype(font_path, font_size)
                    break
                    
            if font is None:
                # Fall back to default font
                font = ImageFont.load_default()
                
        except Exception as e:
            print(f"Warning: Could not load custom font, using default. Error: {e}")
            font = ImageFont.load_default()
        
        # Text to add
        text = "Edge"
        
        # Calculate text size
        try:
            text_width, text_height = draw.textsize(text, font=font)
        except:
            # For newer Pillow versions
            text_width, text_height = font.getbbox(text)[2:4]
        
        # Position text in bottom right, with a small margin
        margin = int(img.width * 0.05)  # 5% margin
        position = (img.width - text_width - margin, img.height - text_height - margin)
        
        # Outline parameters
        outline_color = (0, 0, 0, 255)  # Black outline
        outline_width = max(1, int(img.width * 0.004))  # Scale outline width with image
        
        # Draw text outline by drawing the text multiple times with small offsets
        for dx in range(-outline_width, outline_width + 1, max(1, outline_width // 2)):
            for dy in range(-outline_width, outline_width + 1, max(1, outline_width // 2)):
                if dx != 0 or dy != 0:  # Skip the center position (that's for the main text)
                    draw.text((position[0] + dx, position[1] + dy), text, font=font, fill=outline_color)
        
        # Draw the main text
        draw.text(position, text, font=font, fill=(255, 255, 255, 255))  # White text
        
        # Save the modified image
        img.save(icon_path)
        print(f"Successfully added 'Edge' text with outline to {icon_path}")
        
        return True
    except Exception as e:
        print(f"Error modifying icon: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) > 1:
        icon_path = sys.argv[1]
    else:
        # Default path
        script_dir = os.path.dirname(os.path.abspath(__file__))
        icon_path = os.path.join(script_dir, "..", "..", "public", "todoforai_original_icon.png")
    
    if not os.path.exists(icon_path):
        print(f"Error: Icon file not found at {icon_path}")
        sys.exit(1)
    
    success = add_edge_text(icon_path)
    sys.exit(0 if success else 1)