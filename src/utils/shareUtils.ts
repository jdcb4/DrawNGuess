
/**
 * Share Image Generator - Design 2: Photo Strip / Camera Roll Aesthetic
 * 
 * Generates a vertical film-strip style image of the game results.
 * Features:
 * - Dark "film" background with perforation holes
 * - Polaroid-style content frames
 * - Handwritten-style metadata
 * - Uses Web Share API for native sharing on mobile/desktop
 * - Falls back to download if sharing not supported
 */

export const generateImageStrip = async (pages: any[], bookOwner: string, roomCode: string) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Configuration
    const width = 800; // High res width
    const frameMargin = 80; // Distance from perforated edge
    const frameWidth = width - (frameMargin * 2);
    const frameHeight = 280; // Height of the content area inside polaroid
    const polaroidBottomPad = 60; // Space for caption
    const polaroidTotalHeight = frameHeight + polaroidBottomPad + 16; // 16px top/side padding
    const gapBetweenFrames = 40;

    // Calculate items to render
    const items: any[] = [];

    // Process pages into items
    for (const page of pages) {
        if (page.type === 'word' && page.playerName === 'SECRET') {
            items.push({ type: 'secret', content: page.content, author: bookOwner });
        } else if (page.type === 'draw') {
            items.push({ type: 'draw', content: page.content, author: page.playerName });
        } else if (page.type === 'guess') {
            items.push({ type: 'guess', content: page.content, author: page.playerName });
        }
    }

    // Calculate total height
    const headerHeight = 140;
    const footerHeight = 80;
    const contentHeight = items.length * (polaroidTotalHeight + gapBetweenFrames) - gapBetweenFrames; // remove last gap
    const totalHeight = headerHeight + contentHeight + footerHeight;

    canvas.width = width;
    canvas.height = totalHeight;

    // --- Background & Perforations ---
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Perforations
    ctx.fillStyle = '#000';
    const perfSize = 30;
    const perfGap = 60;

    for (let y = 20; y < canvas.height; y += perfGap) {
        // Left holes
        ctx.beginPath();
        ctx.roundRect(15, y, 40, perfSize, 4);
        ctx.fill();

        // Right holes
        ctx.beginPath();
        ctx.roundRect(width - 55, y, 40, perfSize, 4);
        ctx.fill();
    }

    // --- Header ---
    ctx.textAlign = 'center';

    // Main Title
    ctx.fillStyle = '#FF6B9D';
    ctx.font = 'italic bold 48px Georgia, serif';
    ctx.fillText(`${bookOwner}'s Memories`, width / 2, 80);

    // Subtitle
    ctx.fillStyle = '#888';
    ctx.font = '24px monospace';
    const date = new Date().toLocaleDateString();
    ctx.fillText(`FILM ROLL • ${date} • ${roomCode}`, width / 2, 120);

    // --- Render Items ---
    let currentY = headerHeight;

    for (const item of items) {
        const x = frameMargin;

        // Polaroid Background (White paper)
        ctx.save();
        ctx.fillStyle = '#f5f5f5';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 10;
        ctx.beginPath();
        ctx.roundRect(x, currentY, frameWidth, polaroidTotalHeight, 2);
        ctx.fill();
        ctx.restore();

        // Inner Content Box
        const contentX = x + 16;
        const contentY = currentY + 16;
        const contentW = frameWidth - 32;
        const contentH = frameHeight;

        if (item.type === 'secret') {
            // Secret Word Style
            ctx.fillStyle = '#FF6B9D';
            ctx.fillRect(contentX, contentY, contentW, contentH);

            ctx.fillStyle = '#000';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            ctx.font = 'bold 24px sans-serif';
            ctx.fillText('🎯 SECRET WORD', width / 2, contentY + 60);

            ctx.font = 'bold 64px sans-serif';
            // Scale text if too long
            const measure = ctx.measureText(item.content);
            if (measure.width > contentW - 40) {
                const scale = (contentW - 40) / measure.width;
                ctx.font = `bold ${64 * scale}px sans-serif`;
            }
            ctx.fillText(item.content, width / 2, contentY + (contentH / 2) + 20);

            // Caption
            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = '#333';
            ctx.font = 'italic 28px Georgia, serif';
            ctx.fillText(`~ ${item.author} ~`, width / 2, currentY + polaroidTotalHeight - 20);

        } else if (item.type === 'guess') {
            // Guess Style
            ctx.fillStyle = '#4ECDC4';
            ctx.fillRect(contentX, contentY, contentW, contentH);

            ctx.fillStyle = '#000';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            ctx.font = 'bold 42px sans-serif';
            // Wrap text logic could handle long guesses, but simple scaling for now
            const measure = ctx.measureText(`"${item.content}"`);
            if (measure.width > contentW - 60) {
                const scale = (contentW - 60) / measure.width;
                ctx.font = `bold ${42 * scale}px sans-serif`;
            }

            ctx.fillText(`"${item.content}"`, width / 2, contentY + (contentH / 2));

            // Caption
            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = '#333';
            ctx.font = 'italic 28px Georgia, serif';
            ctx.fillText(`${item.author}`, width / 2, currentY + polaroidTotalHeight - 20);

        } else if (item.type === 'draw') {
            // Draw Style
            ctx.fillStyle = '#fff';
            ctx.fillRect(contentX, contentY, contentW, contentH); // White bg behind image

            // Load and draw image
            const img = new Image();
            // We need to wait for image to load
            await new Promise<void>((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => {
                    console.error('Failed to load image for canvas');
                    resolve(); // Continue anyway
                };
                img.src = item.content; // Content is base64 data URL
            });

            // Draw image centered/fitted
            // The Canvas component output is usually transparent PNG. 
            // We drew white bg above, so it should look fine.
            ctx.drawImage(img, contentX, contentY, contentW, contentH);

            // Caption
            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = '#333';
            ctx.font = 'italic 28px Georgia, serif';
            ctx.fillText(`Drawing by ${item.author}`, width / 2, currentY + polaroidTotalHeight - 20);
        }

        currentY += polaroidTotalHeight + gapBetweenFrames;
    }

    // --- Footer ---
    ctx.save();
    ctx.translate(width / 2, currentY + 30);
    // ctx.rotate(0.02); // Slight jaunty angle for stamp
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FF6B9D';
    ctx.font = 'bold 24px monospace';
    ctx.fillText('★ DRAWNGUESS ★', 0, 0);
    ctx.restore();

    // Try to share using Web Share API, fallback to download
    try {
        // Convert canvas to blob for sharing
        const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Failed to create blob'));
            }, 'image/png', 0.9);
        });

        const fileName = `${bookOwner}'s Book - ${roomCode}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });

        // Check if Web Share API is available and supports files
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: `${bookOwner}'s Book - DrawNGuess`,
                text: `Check out this hilarious game! Room code: ${roomCode}`,
                files: [file]
            });
            console.log('Shared successfully via Web Share API');
        } else {
            // Fallback to download
            throw new Error('Web Share API not supported');
        }
    } catch (err) {
        // Fallback to download
        console.log('Falling back to download', err);
        const link = document.createElement('a');
        link.download = `${bookOwner}'s Book - ${roomCode}.png`;
        link.href = canvas.toDataURL('image/png', 0.9);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};
