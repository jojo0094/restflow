import React from 'react';
import SideMenuIcon from './SideMenuIcon';

interface Props {
        toggleWorkflow: () => void;
}

export default function SideMenu({ toggleWorkflow }: Props) {
        return (
                <div className="w-16 bg-gray-800 flex flex-col items-center py-4">
                        <SideMenuIcon onClick={toggleWorkflow} />
                </div>
        );
}

