import React from 'react';
import styles from './Input.module.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}

export const Input: React.FC<InputProps> = ({ label, ...props }) => {
    return (
        <div className={styles.wrapper}>
            {label && <label className={styles.label}>{label}</label>}
            <input className={styles.input} {...props} />
            <div className={styles.line}></div>
        </div>
    );
};
