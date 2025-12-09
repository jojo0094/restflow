import React, { useState } from 'react';
import SideStack from './LeftStack';
import MapEngine from './MapEngine';
import RightBar from './RightBar';
import ZoomControl from './ZoomControl';

export default function MapPanel() {
        const [leftAOpen, setLeftAOpen] = useState(false);
        const [leftBOpen, setLeftBOpen] = useState(false);
        const [leftCOpen, setLeftCOpen] = useState(false);
        const [rightOpen, setRightOpen] = useState(false);

        return (
                <div className="map-panel" style={{ height: '100%', display: 'flex', position: 'relative' }}>
                        <div className="map-left" style={{ display: 'flex', flexDirection: 'row' }}>
                                <SideStack name="A" open={leftAOpen} onToggle={() => setLeftAOpen((s) => !s)}>
                                        <div style={{ padding: 12 }}>Left A content</div>
                                </SideStack>

                                <SideStack Stack name="B" open={leftBOpen} onToggle={() => setLeftBOpen((s) => !s)}>
                                        <div style={{ padding: 12 }}>Left B content</div>
                                </SideStack>
                        </div>

                        <div className="map-center" style={{ flex: 1, position: 'relative' }}>
                                <MapEngine />
                                <ZoomControl />
                        </div>

                        <SideStack name="C" open={leftCOpen} onToggle={() => setLeftCOpen((s) => !s)}>
                                <div style={{ padding: 12 }}>Right C content</div>
                        </SideStack>
                        {/* <div className="map-right" style={{ width: 280, borderLeft: '1px solid #e5e7eb', position: 'relative' }}> */}
                        {/* <RightBar open={rightOpen} onToggle={() => setRightOpen((s) => !s)} /> */}
                        {/*         <LeftStack name="C" open={leftCOpen} onToggle={() => setLeftCOpen((s) => !s)}> */}
                        {/*                 <div style={{ padding: 12 }}>Right C content</div> */}
                        {/*         </LeftStack> */}
                        {/* </div> */}
                </div>
        );
}
