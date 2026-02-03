import React, { useState } from 'react';
import type { Room } from '@shared/types';
import { Canvas } from '../../components/Canvas';
import { useSocket } from '../../hooks/useSocket';
import { useNavigate } from 'react-router-dom';
import { Toast } from '../../components/ui/Toast';
import './BookViewer.css';

interface BookViewerProps {
    room: Room;
}

export const BookViewer: React.FC<BookViewerProps> = ({ room }) => {
    const navigate = useNavigate();
    const { socket } = useSocket();
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showToast, setShowToast] = useState(false);

    // Swipe State
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > 50;
        const isRightSwipe = distance < -50;

        if (isLeftSwipe) {
            nextPage();
        } else if (isRightSwipe) {
            prevPage();
        }
    };

    // Find the book that belongs to this player
    const player = room.players.find(p => p.socketId === socket.id);
    const myBook = room.gameState.books.find(b => b.id === player?.id);

    if (!myBook) {
        return (
            <div className="book-viewer">
                <div className="container center">
                    <h2>Loading your book...</h2>
                </div>
            </div>
        );
    }

    // Include secret word as first page for display
    const allPages = [
        { type: 'word' as const, content: myBook.secretWord, playerName: 'SECRET', disconnected: false },
        // Filter out only the initial secret word page, preserve any other word pages
        ...myBook.pages.filter(p => !(p.type === 'word' && p.playerName === 'SECRET'))
    ];

    const currentPage = allPages[currentPageIndex];
    const totalPages = allPages.length;

    const nextPage = () => {
        if (currentPageIndex < totalPages - 1) {
            setCurrentPageIndex(currentPageIndex + 1);
        }
    };

    const prevPage = () => {
        if (currentPageIndex > 0) {
            setCurrentPageIndex(currentPageIndex - 1);
        }
    };

    const renderPage = (page: any) => {
        if (page.type === 'word') {
            return (
                <div className="page-word">
                    <div className="page-label">SECRET WORD</div>
                    <div className="word-display">{page.content}</div>
                </div>
            );
        } else if (page.type === 'guess') {
            return (
                <div className="page-guess">
                    <div className="page-label">
                        GUESS BY: {page.playerName}
                        {page.disconnected && <span className="disconnected-badge">⚠️ Auto-filled</span>}
                    </div>
                    <div className="guess-display">{page.content}</div>
                </div>
            );
        } else if (page.type === 'draw') {
            return (
                <div className="page-draw">
                    <div className="page-label">
                        DRAWN BY: {page.playerName}
                        {page.disconnected && <span className="disconnected-badge">⚠️ Auto-filled</span>}
                    </div>
                    <Canvas
                        initialDrawing={page.content}
                        onDrawingComplete={() => { }}
                        readonly={true}
                    />
                </div>
            );
        }
    };

    const handleShare = async () => {
        setIsGenerating(true);
        // Add delay for UX
        await new Promise(r => setTimeout(r, 800));
        await generateImageStrip(allPages, myBook.ownerName);
        setIsGenerating(false);
        setShowToast(true);
    };

    const handleHome = () => {
        socket.disconnect();
        navigate('/');
    };

    return (
        <div className="book-viewer">
            <Toast
                message="Image Saved! 📸"
                show={showToast}
                onClose={() => setShowToast(false)}
            />

            <div className="book-header">
                <h1 className="book-title">📖 {myBook.ownerName}'s Book</h1>
                <p className="book-subtitle">Swipe through to see how your word evolved!</p>
            </div>

            <div className="book-content">
                <div
                    className="page-container"
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                >
                    {renderPage(currentPage)}
                </div>

                <div className="page-navigation">
                    <button
                        className="nav-btn prev"
                        onClick={prevPage}
                        disabled={currentPageIndex === 0}
                    >
                        ← Prev
                    </button>

                    <div className="page-indicators">
                        {allPages.map((_, index) => (
                            <div
                                key={index}
                                className={`page-dot ${index === currentPageIndex ? 'active' : ''}`}
                                onClick={() => setCurrentPageIndex(index)}
                            />
                        ))}
                    </div>

                    <button
                        className="nav-btn next"
                        onClick={nextPage}
                        disabled={currentPageIndex === totalPages - 1}
                    >
                        Next →
                    </button>
                </div>

                <div className="page-counter">
                    Page {currentPageIndex + 1} of {totalPages}
                </div>
            </div>

            <div className="final-actions">
                <button className="action-btn home" onClick={handleHome}>
                    🏠 Return to Home
                </button>
                <button
                    className="action-btn share"
                    onClick={handleShare}
                    disabled={isGenerating}
                >
                    {isGenerating ? 'Generating...' : '📸 Share Result'}
                </button>
            </div>

            <div className="book-instructions">
                <p>🗣️ Share the hilarious results with your friends!</p>
                <p>Other players can browse their own books too.</p>
            </div>
        </div >
    );
};

// Start of Share Logic helper
const generateImageStrip = async (pages: any[], bookOwner: string) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Config
    const width = 600;
    const cardPadding = 15;
    const cornerRadius = 15;

    // Calculate dynamic height and prepare layout
    let totalHeight = 100; // Header fixed height
    const items: any[] = [];

    for (const page of pages) {
        if (page.type === 'word' && page.playerName === 'SECRET') {
            // Secret Word Card
            const height = 120;
            items.push({ type: 'secret', content: page.content, height });
            totalHeight += height + cardPadding;
        } else if (page.type === 'draw') {
            // Drawing Card
            const height = 450 + 60; // Image + Author Bar
            items.push({ type: 'draw', content: page.content, author: page.playerName, height });
            totalHeight += height + cardPadding;
        } else if (page.type === 'guess') {
            // Guess Card
            const height = 140;
            items.push({ type: 'guess', content: page.content, author: page.playerName, height });
            totalHeight += height + cardPadding;
        }
    }

    // Set Canvas Size
    canvas.width = width;
    canvas.height = totalHeight + 40; // Add bottom padding

    // Background
    ctx.fillStyle = '#121212';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // --- Header ---
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FF6B9D';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText(`${bookOwner}'s Book`, width / 2, 60);

    // --- Render Items ---
    let currentY = 100;

    const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        ctx.fill();
    };

    for (const item of items) {
        const x = 20;
        const w = width - 40;

        if (item.type === 'secret') {
            // Box
            ctx.fillStyle = '#FF6B9D';
            ctx.shadowColor = 'rgba(255, 107, 157, 0.4)';
            ctx.shadowBlur = 10;
            roundRect(x, currentY, w, item.height, cornerRadius);
            ctx.shadowBlur = 0;

            // Text
            ctx.fillStyle = '#000';
            ctx.font = 'bold 20px sans-serif';
            ctx.fillText('SECRET WORD', width / 2, currentY + 40);

            ctx.fillStyle = '#000';
            ctx.font = 'bold 40px sans-serif';
            ctx.fillText(item.content, width / 2, currentY + 85);

        } else if (item.type === 'guess') {
            // Box
            ctx.fillStyle = '#333';
            roundRect(x, currentY, w, item.height, cornerRadius);

            // Label
            ctx.fillStyle = '#4ECDC4';
            ctx.font = 'italic 16px sans-serif';
            ctx.fillText(`Guessed by ${item.author}`, width / 2, currentY + 40);

            // Content
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 32px sans-serif';
            ctx.fillText(`"${item.content}"`, width / 2, currentY + 90);

        } else if (item.type === 'draw') {
            // Box Background
            ctx.fillStyle = '#fff'; // White bg for drawing to look correct
            roundRect(x, currentY, w, item.height, cornerRadius);

            // Image
            const img = new Image();
            await new Promise((resolve) => {
                img.onload = resolve;
                img.src = item.content;
            });

            // Draw Image
            // We want to fit it nicely? The canvas itself is likely 3:2 or similar. 
            // We allocated 450px height.
            ctx.drawImage(img, x, currentY, w, 450);

            // Author Bar at bottom of card
            ctx.fillStyle = '#222';
            // Draw bottom rounded rect for text
            ctx.beginPath();
            ctx.roundRect(x, currentY + 450, w, 60, [0, 0, cornerRadius, cornerRadius]);
            ctx.fill();

            ctx.fillStyle = '#aaa';
            ctx.font = '16px sans-serif';
            ctx.fillText(`Drawn by ${item.author}`, width / 2, currentY + 485);
        }

        currentY += item.height + cardPadding;
    }

    // Trigger download
    const link = document.createElement('a');
    link.download = `telestrations-${bookOwner}.png`;
    link.href = canvas.toDataURL();
    document.body.appendChild(link); // Required for Firefox/some browsers
    link.click();
    document.body.removeChild(link);
};
