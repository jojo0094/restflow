import React, { useState } from 'react';
import SideMenu from './SideMenu';
import WorkflowCanvas from './WorkflowCanvas';

export default function Layout() {
        const [showWorkflow, setShowWorkflow] = useState(false);
        return (
                <div className="flex h-screen w-screen">
                        {/* Sidebar */}
                        <SideMenu toggleWorkflow={() => setShowWorkflow(!showWorkflow)} />
                        {/* Main content */}
                        <div className="flex-1 h-screen">
                                {showWorkflow ? <WorkflowCanvas /> : <p>Click the menu icon to open workflow</p>}
                        </div>
                </div>
        );
}
