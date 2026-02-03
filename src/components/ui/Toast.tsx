import React, { useEffect } from 'react';
import styles from './Toast.module.css';

interface ToastProps {
    message: string;
    show: boolean;
    onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, show, onClose }) => {
    useEffect(() => {
        if (show) {
            const timer = setTimeout(onClose, 3000);
            return () => clearTimeout(timer);
        }
    }, [show, onClose]);

    if (!show) return null;

    return (
        <div className={styles.toast}>
            <span className={styles.icon}>⚠️</span>
            {message}
        </div>
    );
};
