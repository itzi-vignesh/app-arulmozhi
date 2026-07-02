import os
from PIL import Image, ImageDraw

def generate_icons():
    """
    Creates icons/ directory and draws professional high-quality PNG icons
    for extension deployment sizes 16, 48, and 128.
    """
    os.makedirs("icons", exist_ok=True)
    
    sizes = [16, 48, 128]
    for size in sizes:
        # Create transparent canvas
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        # Sleek outer blue/cyan circle
        margin = max(1, size // 12)
        border_width = max(1, size // 12)
        
        # Draw dark slate blue inner circle
        draw.ellipse(
            [margin, margin, size - margin, size - margin], 
            fill=(15, 23, 42, 255), 
            outline=(0, 242, 254, 255), 
            width=border_width
        )
        
        # Draw a vibrant cyan target eye in the center
        eye_margin = size // 3
        draw.ellipse(
            [eye_margin, eye_margin, size - eye_margin, size - eye_margin], 
            fill=(0, 242, 254, 255)
        )
        
        # Save PNG icon
        img.save(f"icons/icon{size}.png", "PNG")
        print(f"Created icons/icon{size}.png successfully.")

if __name__ == "__main__":
    generate_icons()
