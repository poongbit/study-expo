#import <React/RCTViewManager.h>
#import <React/RCTBridgeModule.h>

// ── View Manager ──────────────────────────────────────────────────────────
RCT_EXTERN_MODULE(PencilCanvasViewManager, RCTViewManager)

RCT_EXTERN__BLOCK_PROP_GROUP(PencilCanvasViewManager,
  onStrokesExported,
  onDrawingChanged
)

// ── Native Module ─────────────────────────────────────────────────────────
RCT_EXTERN_MODULE(PencilCanvasModule, NSObject)

RCT_EXTERN_METHOD(exportStrokes)
RCT_EXTERN_METHOD(clearCanvas)
