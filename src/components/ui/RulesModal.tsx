import React from 'react';
import styles from './Modal.module.css';

interface RulesModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <header className={styles.header}>
                    <h2>HOW TO PLAY</h2>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </header>
                <div className={styles.content}>
                    <p style={{ marginBottom: '1rem' }}>
                        <strong>1. GET A WORD:</strong> You'll start with a secret word or phrase.
                    </p>

                    <p style={{ marginBottom: '1rem' }}>
                        <strong>2. SKETCH IT:</strong> Draw the word to the best of your ability (or hilariously poorly).
                    </p>

                    <p style={{ marginBottom: '1rem' }}>
                        <strong>3. PASS IT:</strong> Your book passes to the next player.
                    </p>

                    <p style={{ marginBottom: '1rem' }}>
                        <strong>4. GUESS IT:</strong> The next player guesses what you drew. Then <i>that</i> guess is drawn by the next person!
                    </p>

                    <p style={{ marginBottom: '1rem' }}>
                        <strong>5. REVEAL:</strong> Once the book returns to its owner, reveal the chain of drawings and guesses!
                    </p>
                </div>
                <footer className={styles.footer}>
                    <button
                        onClick={onClose}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            backgroundColor: 'var(--color-primary)',
                            color: '#000',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            fontFamily: 'var(--font-display)',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            textTransform: 'uppercase'
                        }}
                    >
                        GOT IT!
                    </button>
                </footer>
            </div>
        </div>
    );
};
