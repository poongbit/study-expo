import Foundation
import React

// MARK: - PencilCanvasModule
// React Native NativeModules.PencilCanvas 로 접근
@objc(PencilCanvasModule)
class PencilCanvasModule: NSObject, RCTBridgeModule {

  static func moduleName() -> String! {
    return "PencilCanvas"
  }

  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  // 현재 표시 중인 PencilCanvasView 를 약참조로 보관
  // DrawingScreen 에서 ref 를 통해 직접 호출하므로,
  // 여기서는 Notification 방식으로 View 에 명령을 전달합니다.

  @objc func exportStrokes() {
    DispatchQueue.main.async {
      NotificationCenter.default.post(
        name: NSNotification.Name("PencilCanvasExport"),
        object: nil
      )
    }
  }

  @objc func clearCanvas() {
    DispatchQueue.main.async {
      NotificationCenter.default.post(
        name: NSNotification.Name("PencilCanvasClear"),
        object: nil
      )
    }
  }
}
