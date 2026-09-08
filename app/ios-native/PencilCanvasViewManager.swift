import Foundation
import React

// MARK: - PencilCanvasViewManager
@objc(PencilCanvasViewManager)
class PencilCanvasViewManager: RCTViewManager {

  override func view() -> UIView! {
    return PencilCanvasView()
  }

  override static func requiresMainQueueSetup() -> Bool {
    return true
  }

  // ── React props ──────────────────────────────────────────────────────
  // onStrokesExported 와 onDrawingChanged 는 PencilCanvasView의 @objc var 로
  // 자동 매핑되므로 별도 propConfig 불필요.

  // ── Commands (RN에서 ref.exportStrokes() / ref.clearCanvas() 로 호출) ──
  override func customDirectEventTypes() -> [AnyHashable]! {
    return ["onStrokesExported", "onDrawingChanged"]
  }
}
