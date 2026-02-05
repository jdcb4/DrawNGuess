import React from 'react';
import { Button } from './Button';
import styles from './Modal.module.css';

interface ModalProps {
    isOpen: boolean;
    title: string;
    children: React.ReactNode;
    onClose: () => void;
    onConfirm: () => void;
    onCancel?: () => void;
    onAction?: () => void; // Optional third action button
    confirmText?: string;
    cancelText?: string;
    actionText?: string; // Text for third button
    variant?: 'primary' | 'danger';
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    title,
    children,
    onClose,
    onConfirm,
    onCancel,
    onAction,
    confirmText = 'CONFIRM',
    cancelText = 'CANCEL',
    actionText = 'ACTION',
    variant = 'primary'
}) => {
    if (!isOpen) return null;

    const handleCancel = () => {
        if (onCancel) {
            onCancel();
        } else {
            onClose();
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <header className={styles.header}>
                    <div style={{ width: 24 }}></div> {/* Spacer for centering */}
                    <h2>{title}</h2>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </header>
                <div className={styles.content}>
                    {children}
                </div>
                <footer className={styles.footer}>
                    {onAction && (
                        <Button variant="secondary" onClick={onAction}>{actionText}</Button>
                    )}
                    <Button variant="outline" onClick={handleCancel}>{cancelText}</Button>
                    <Button
                        variant={variant === 'danger' ? 'danger' : 'primary'}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </Button>
                </footer>
            </div>
        </div>
    );
};
