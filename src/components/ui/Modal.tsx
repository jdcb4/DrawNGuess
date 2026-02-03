import React from 'react';
import { Button } from './Button';
import styles from './Modal.module.css';

interface ModalProps {
    isOpen: boolean;
    title: string;
    children: React.ReactNode;
    onClose: () => void;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    variant?: 'primary' | 'danger';
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    title,
    children,
    onClose,
    onConfirm,
    confirmText = 'CONFIRM',
    cancelText = 'CANCEL',
    variant = 'primary'
}) => {
    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <header className={styles.header}>
                    <h2>{title}</h2>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </header>
                <div className={styles.content}>
                    {children}
                </div>
                <footer className={styles.footer}>
                    <Button variant="outline" onClick={onClose}>{cancelText}</Button>
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
