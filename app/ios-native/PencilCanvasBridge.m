#import <React/RCTBridgeModule.h>
#import <React/RCTViewManager.h>

// ── View Manager ──────────────────────────────────────────────────────────
@interface RCT_EXTERN_MODULE(PencilCanvasViewManager, RCTViewManager)
@end

// ── Native Module ─────────────────────────────────────────────────────────
@interface RCT_EXTERN_MODULE(PencilCanvasModule, NSObject)

RCT_EXTERN_METHOD(exportStrokes)
RCT_EXTERN_METHOD(clearCanvas)

@end
