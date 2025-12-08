import React from 'react';

interface Props {
        onClick: () => void;
}

export default function SideMenuIcon({ onClick }: Props) {
        return (
                <button
                        className="text-white p-2 hover:bg-gray-700 rounded"
                        onClick={onClick}
                        aria-label="Toggle Workflow"
                >
                        ☰
                </button>
        );
}

