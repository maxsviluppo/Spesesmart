
/**
 * Compresses and resizes an image file to a small square avatar.
 * Returns a Data URL (Base64) string suitable for storage/display.
 * Max size target: ~20-50KB
 */
export const processAvatarImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Target dimensions
                const SIZE = 256;

                // Calculate crop
                let width = img.width;
                let height = img.height;
                let startX = 0;
                let startY = 0;

                if (width > height) {
                    width = height; // Square crop from center
                    startX = (img.width - height) / 2;
                } else {
                    height = width;
                    startY = (img.height - width) / 2;
                }

                canvas.width = SIZE;
                canvas.height = SIZE;

                if (ctx) {
                    ctx.drawImage(img, startX, startY, width, height, 0, 0, SIZE, SIZE);
                    // Compress to JPEG 70% quality
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(dataUrl);
                } else {
                    reject(new Error("Canvas context failed"));
                }
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};
