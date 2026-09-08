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
}
