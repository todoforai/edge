#!/usr/bin/env python3
"""
Script to add a large "E" text to the middle of the icon.
Designed to be deterministic - same input always produces same output.
"""
import os
import sys
import shutil
from PIL import Image, ImageDraw, ImageFont, ImageChops

def add_edge_text(source_path, target_path):
    try:
        # Create target directory if it doesn't exist
        target_dir = os.path.dirname(target_path)

        # Open the source image
        source_img = Image.open(source_path)
        
        # Create a copy to work on
        labeled = source_img.copy()

        # Create a drawing context
        draw = ImageDraw.Draw(labeled)
        
        # Make text about 2.5 times larger than before
        font_size = int(source_img.width * 0.6)  # Increased from 0.20 to 0.50
        
        # Try to use a TrueType font with the specified size
        try:
            # Try to find a system font that's likely to exist
            font_paths = [
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",  # Linux
                "/Library/Fonts/Arial Bold.ttf",  # macOS
                "C:\\Windows\\Fonts\\arialbd.ttf",  # Windows
                "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",  # Arch Linux
                "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf"  # Ubuntu
            ]
            
            font = None
            for font_path in font_paths:
                if os.path.exists(font_path):
                    font = ImageFont.truetype(font_path, font_size)
                    break
                    
            # If no system font found, use the default font
            if font is None:
                # For older Pillow versions that don't support resizing default font
                print("No TrueType font found, using default font (may be small)")
                font = ImageFont.load_default()
        except Exception as e:
            print(f"Font error: {e}, falling back to default font")
            font = ImageFont.load_default()
        
        # Text to add - just "E" instead of "EDGE"
        text = "E"
        
        # Calculate text size
        try:
            # For newer Pillow versions
            text_bbox = font.getbbox(text)
            text_width, text_height = text_bbox[2] - text_bbox[0], text_bbox[3] - text_bbox[1]
        except:
            # Fallback for older versions
            text_width, text_height = draw.textsize(text, font=font)
        print('text_height:', text_height)
        
        # Position text in the middle of the image
        position = (
            (source_img.width) * 0.55,
            (source_img.height - text_height) * 0.65
        )
        
        # Increase outline width for better visibility
        outline_color = (0, 0, 0, 255)  # Black outline
        outline_width = max(10, int(source_img.width * 0.012))  # Increased outline width
        
        # Draw text outline with fixed offsets
        offsets = []
        for dx in range(-outline_width, outline_width + 1):
            for dy in range(-outline_width, outline_width + 1):
                if dx != 0 or dy != 0:  # Skip the center position
                    offsets.append((dx, dy))
        
        # Sort offsets to ensure consistent drawing order
        offsets.sort()
        
        # Draw outline in deterministic order
        for dx, dy in offsets:
            draw.text((position[0] + dx, position[1] + dy), text, font=font, fill=outline_color)
        
        # Draw the main text
        draw.text(position, text, font=font, fill=(255, 255, 255, 255))  # White text
        
        # Check if target already exists and compare
        if os.path.exists(target_path):
            try:
                target_img = Image.open(target_path)
                
                # If images are the same size, check pixel data
                if (source_img.size == target_img.size and 
                    labeled.size == target_img.size):
                    
                    # Use ImageChops to compare
                    diff = ImageChops.difference(labeled, target_img)
                    
                    # If no difference, don't save
                    if not diff.getbbox():
                        print(f"Target already has 'E' text, no changes needed to {target_path}")
                        return True
            except Exception as e:
                print(f"Warning: Could not compare with existing target: {e}")
        
        # Save with deterministic settings
        labeled.save(target_path, pnginfo=None, compress_level=9)
        print(f"Created/updated {target_path} with 'E' text")
        return True
            
    except Exception as e:
        print(f"Error processing icon: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: add_edge_text.py SOURCE_ICON [TARGET_ICON]")
        sys.exit(1)
        
    source_path = sys.argv[1]
    
    if len(sys.argv) > 2:
        target_path = sys.argv[2]
    else:
        target_path = source_path
    
    if not os.path.exists(source_path):
        print(f"Error: Source icon file not found at {source_path}")
        sys.exit(1)
    
    success = add_edge_text(source_path, target_path)
    sys.exit(0 if success else 1)