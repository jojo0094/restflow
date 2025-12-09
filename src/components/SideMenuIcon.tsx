import React from 'react';

interface Props {
        onClick: () => void;
        label?: string;
        icon?: React.ReactNode;
}

export default function SideMenuIcon({ onClick, label = 'Open', icon }: Props) {
        return (
                <button
                        onClick={onClick}
                        aria-label={label}
                        style={{ background: 'transparent', border: 'none', color: 'white' }}
                >
                        {icon ?? '☰'}
                </button>
        );
}

