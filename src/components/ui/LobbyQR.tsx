import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import styles from './QRCode.module.css';

interface LobbyQRProps {
    code: string;
}

export const LobbyQR: React.FC<LobbyQRProps> = ({ code }) => {
    const url = `${window.location.origin}/join/${code}`;
    const [expanded, setExpanded] = React.useState(false);

    return (
        <>
            <div className={styles.container} onClick={() => setExpanded(true)}>
                <div className={styles.qr}>
                    <QRCodeSVG value={url} size={128} level={"L"} includeMargin={false} fgColor={"var(--color-primary)"} bgColor={"var(--color-surface)"} />
                </div>
                <p className={styles.label}>TAP TO EXPAND</p>
            </div>

            {expanded && (
                <div className={styles.overlay} onClick={() => setExpanded(false)}>
                    <div className={styles.expandedQr} onClick={e => e.stopPropagation()}>
                        <QRCodeSVG value={url} size={300} level={"L"} includeMargin={false} fgColor={"black"} bgColor={"white"} />
                    </div>
                    <button className={styles.closeBtn} onClick={() => setExpanded(false)}>✕</button>
                </div>
            )}
        </>
    );
};
