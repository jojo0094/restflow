import React from 'react';
import SideMenuIcon from './SideMenuIcon';

interface Props {
        toggleWorkflow: () => void;
        close?: () => void;
}

export default function SideMenu({ toggleWorkflow, close }: Props) {
        return (
                <div className="side-menu-root" style={{ padding: 12, width: 280 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3>Menu</h3>
                                <button onClick={close} aria-label="Close" style={{ background: 'none', border: 'none' }}>
                                        ✕
                                </button>
                        </div>

                        <div style={{ marginTop: 12 }}>
                                <button onClick={toggleWorkflow} style={{ display: 'block', width: '100%', padding: '8px 12px', borderRadius: 6 }}>
                                        Toggle Workflow
                                </button>
                        </div>

                        <div style={{ marginTop: 18, color: '#6b7280' }}>Other controls can go here</div>
                </div>
        );
}

