import WorkflowCanvas from "../WorkflowCanvas";
import SideStack from "./SideStack";

export default function WorkflowPanel() {
  return (
    <div
      className="workflow-panel"
      style={{ display: "flex", flexDirection: "row", height: "100%", width: "100%" }}
    >
      {/* Left SideStack */}
      <SideStack name="left-stack-A" side="left">
        <div style={{ height: "100%", background: "#f3f4f6" }}>
          Left Stack Content
        </div>
      </SideStack>

      {/* WorkflowCanvas in the middle */}
      <div
        className="workflow-canvas"
        style={{
          position: "absolute",
          left: "100%",
          top: 0,
          width: 920,
          height: "100%",
          transition: "left 240ms ease-in-out",
          boxShadow: "-4px 0 12px rgba(0,0,0,0.08)",
          background: "white",
        }}
      >
        {/* <div */}
        {/*   style={{ */}
        {/*     position: "absolute", */}
        {/*     left: showWorkflow ? 0 : "100%", */}
        {/*     top: 0, */}
        {/*     width: 920, */}
        {/*     height: "100%", */}
        {/*     transition: "left 240ms ease-in-out", */}
        {/*     boxShadow: "-4px 0 12px rgba(0,0,0,0.08)", */}
        {/*     background: "white", */}
        {/*   }} */}
        {/* > */}

        <WorkflowCanvas />
      </div>

      {/* Right SideStack */}
      <SideStack name="right-stack-B" side="right">
        <div style={{ height: "100%", background: "#f3f4f6" }}>
          Right Stack Content
        </div>
      </SideStack>
    </div>
  );
}
