import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export const GameEnd: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="container full-screen center" style={{ justifyContent: 'center', textAlign: 'center' }}>
            <h1 style={{ fontSize: '3rem', color: 'var(--color-primary)' }}>GAME OVER</h1>
            <p>THANKS FOR PLAYING</p>
            <div style={{ marginTop: '2rem' }}>
                <Button onClick={() => navigate('/')}>BACK TO HOME</Button>
            </div>
        </div>
    );
};
