import React, { useState, useEffect } from 'react';
import type { Room } from '@shared/types';
import { Canvas } from '../../components/Canvas';
import { useSocket } from '../../hooks/useSocket';
import { useNavigate } from 'react-router-dom';
import { Toast } from '../../components/ui/Toast';
import { generateImageStrip } from '../../utils/shareUtils';
import './BookViewer.css';

interface BookViewerProps {
    room: Room;
}

/**
 * BookViewer Component
 * 
 * Displays the final "books" at the end of the game.
 * Allows players to navigate through pages (Drawings/Guesses) and
 * browse other players' books using the top navigation arrows.
 * 
 * Features:
 * - Swipe gestures for mobile page navigation
 * - Top-level book selector (Prev/Next Book)
 * - Share functionality (Generates image strip)
 * - "Return to Home" for game reset
 */
export const BookViewer: React.FC<BookViewerProps> = ({ room }) => {
    const navigate = useNavigate();
    const { socket } = useSocket();

    // Identify current player
    const myPlayerId = room.players.find(p => p.socketId === socket.id)?.id;

    // State for which book we are viewing (default to own book)
    const [viewingPlayerId, setViewingPlayerId] = useState<string | null>(myPlayerId || null);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showToast, setShowToast] = useState(false);

    // Swipe State
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    // Reset page index when switching books
    useEffect(() => {
        setCurrentPageIndex(0);
    }, [viewingPlayerId]);

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

    // Get list of players who have books (usually all, but good for safety)
    const bookOwners = room.players.filter(p => room.gameState.books.some(b => b.id === p.id));

    // Sort owners to have "Me" first, then others alphabetically or by ID
    const sortedOwners = [...bookOwners].sort((a, b) => {
        if (a.id === myPlayerId) return -1;
        if (b.id === myPlayerId) return 1;
        return a.name.localeCompare(b.name);
    });

    const currentOwnerIndex = sortedOwners.findIndex(p => p.id === viewingPlayerId);
    const viewingBook = room.gameState.books.find(b => b.id === viewingPlayerId);

    if (!viewingBook || !viewingPlayerId) {
        return (
            <div className="book-viewer">
                <div className="container center">
                    <h2>Loading books...</h2>
                </div>
            </div>
        );
    }

    // Include secret word as first page for display
    const allPages = [
        { type: 'word' as const, content: viewingBook.secretWord, playerName: 'SECRET', disconnected: false },
        // Filter out only the initial secret word page if it exists in pages array (duplicates check)
        ...viewingBook.pages.filter(p => !(p.type === 'word' && p.playerName === 'SECRET'))
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

    const nextBook = () => {
        const nextIndex = (currentOwnerIndex + 1) % sortedOwners.length;
        setViewingPlayerId(sortedOwners[nextIndex].id);
    };

    const prevBook = () => {
        const prevIndex = (currentOwnerIndex - 1 + sortedOwners.length) % sortedOwners.length;
        setViewingPlayerId(sortedOwners[prevIndex].id);
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
        await generateImageStrip(allPages, viewingBook.ownerName, room.id);
        setIsGenerating(false);
        setShowToast(true);
    };

    const handleHome = () => {
        socket.disconnect();
        navigate('/');
    };

    const isMyBook = viewingPlayerId === myPlayerId;

    return (
        <div className="book-viewer">
            <Toast
                message="Image Saved! 📸"
                show={showToast}
                onClose={() => setShowToast(false)}
            />

            {/* Large Book Navigation - Prominent at top */}
            <div className="book-nav-section">
                <div className="book-nav-label">VIEWING BOOKS</div>

                <div className="book-selector">
                    <button className="book-arrow" onClick={prevBook} aria-label="Previous book">
                        ◀
                    </button>

                    <div className="book-info">
                        <h1 className="book-title">
                            {isMyBook ? 'YOUR BOOK' : `${viewingBook.ownerName}'S BOOK`}
                        </h1>
                        <p className="book-counter">
                            Book {currentOwnerIndex + 1} of {sortedOwners.length}
                        </p>
                    </div>

                    <button className="book-arrow" onClick={nextBook} aria-label="Next book">
                        ▶
                    </button>
                </div>
            </div>

            {/* Visual separator */}
            <div className="section-divider"></div>

            {/* Page Content Area - Centered */}
            <div className="page-content-area">
                <div
                    className="page-display"
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                >
                    {renderPage(currentPage)}
                </div>

                {/* Small Page Navigation - Pinned to content */}
                <div className="page-nav-section">
                    <div className="page-nav-label">PAGES</div>

                    <div className="page-navigation">
                        <button
                            className="page-arrow"
                            onClick={prevPage}
                            disabled={currentPageIndex === 0}
                            aria-label="Previous page"
                        >
                            ◀
                        </button>

                        <div className="page-indicators">
                            {allPages.map((_, index) => (
                                <div
                                    key={index}
                                    className={`page-dot ${index === currentPageIndex ? 'active' : ''}`}
                                    onClick={() => setCurrentPageIndex(index)}
                                    role="button"
                                    aria-label={`Go to page ${index + 1}`}
                                />
                            ))}
                        </div>

                        <button
                            className="page-arrow"
                            onClick={nextPage}
                            disabled={currentPageIndex === totalPages - 1}
                            aria-label="Next page"
                        >
                            ▶
                        </button>
                    </div>

                    <div className="page-counter">
                        Page {currentPageIndex + 1} of {totalPages}
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="final-actions">
                <button className="action-btn home" onClick={handleHome}>
                    🏠 Return to Home
                </button>
                <button
                    className="action-btn share"
                    onClick={handleShare}
                    disabled={isGenerating}
                >
                    {isGenerating ? 'Generating...' : `📸 Share ${isMyBook ? 'My' : 'This'} Book`}
                </button>
            </div>
        </div>
    );
};


