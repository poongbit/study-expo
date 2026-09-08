import UIKit
import PencilKit
import React

// MARK: - PencilCanvasView
@objc(PencilCanvasView)
class PencilCanvasView: UIView, PKCanvasViewDelegate {

  // MARK: - Properties
  private let canvasView = PKCanvasView()
  private let toolPicker = PKToolPicker()

  /// React Native callback: stroke export 시 호출
  @objc var onStrokesExported: RCTDirectEventBlock?
  /// React Native callback: drawing 변경 시 호출
  @objc var onDrawingChanged: RCTDirectEventBlock?

  // MARK: - Init
  override init(frame: CGRect) {
    super.init(frame: frame)
    setupCanvas()
    setupNotifications()
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    setupCanvas()
    setupNotifications()
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
  }

  // MARK: - Setup
  private func setupCanvas() {
    canvasView.delegate = self
    canvasView.drawingPolicy = .anyInput   // Apple Pencil + touch 모두 허용
    canvasView.backgroundColor = UIColor(red: 0.98, green: 0.98, blue: 0.99, alpha: 1)
    canvasView.isOpaque = true
    canvasView.translatesAutoresizingMaskIntoConstraints = false

    addSubview(canvasView)
    NSLayoutConstraint.activate([
      canvasView.topAnchor.constraint(equalTo: topAnchor),
      canvasView.leadingAnchor.constraint(equalTo: leadingAnchor),
      canvasView.trailingAnchor.constraint(equalTo: trailingAnchor),
      canvasView.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])
  }

  private func setupNotifications() {
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleExportNotification),
      name: NSNotification.Name("PencilCanvasExport"),
      object: nil
    )
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleClearNotification),
      name: NSNotification.Name("PencilCanvasClear"),
      object: nil
    )
  }

  // MARK: - Window lifecycle
  override func didMoveToWindow() {
    super.didMoveToWindow()
    guard window != nil else { return }
    toolPicker.setVisible(true, forFirstResponder: canvasView)
    toolPicker.addObserver(canvasView)
    canvasView.becomeFirstResponder()
    // 기본 펜 도구
    canvasView.tool = PKInkingTool(.pen, color: .black, width: 5)
  }

  // MARK: - PKCanvasViewDelegate
  func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
    onDrawingChanged?([:])
  }

  // MARK: - Notification handlers
  @objc private func handleExportNotification() {
    exportStrokes()
  }

  @objc private func handleClearNotification() {
    clearCanvas()
  }

  // MARK: - Public API

  /// 현재 드로잉의 모든 stroke를 JSON으로 변환해 onStrokesExported 콜백 전달
  @objc func exportStrokes() {
    let drawing = canvasView.drawing
    let canvasSize = canvasView.bounds.size

    guard canvasSize.width > 0, canvasSize.height > 0 else {
      onStrokesExported?(["strokes": [], "error": "canvas not yet sized"])
      return
    }

    var strokesJSON: [[String: Any]] = []

    for (strokeIndex, stroke) in drawing.strokes.enumerated() {
      var pointsJSON: [[String: Any]] = []
      let path = stroke.path

      for i in 0..<path.count {
        let point = path[i]
        let normX = (point.location.x / canvasSize.width).clamped(to: 0...1)
        let normY = (point.location.y / canvasSize.height).clamped(to: 0...1)

        pointsJSON.append([
          "x":          Double(normX),
          "y":          Double(normY),
          "timeOffset": Double(point.timeOffset),
          "force":      Double(point.force),
          "azimuth":    Double(point.azimuth),
          "altitude":   Double(point.altitude),
        ])
      }

      strokesJSON.append([
        "stroke_id": "stroke_\(strokeIndex)",
        "points":    pointsJSON,
      ])
    }

    onStrokesExported?([
      "canvas_w":     Double(canvasSize.width),
      "canvas_h":     Double(canvasSize.height),
      "stroke_count": strokesJSON.count,
      "strokes":      strokesJSON,
    ])
  }

  /// 캔버스 초기화
  @objc func clearCanvas() {
    canvasView.drawing = PKDrawing()
  }
}

// MARK: - CGFloat clamped helper
private extension CGFloat {
  func clamped(to range: ClosedRange<CGFloat>) -> CGFloat {
    return Swift.min(Swift.max(self, range.lowerBound), range.upperBound)
  }
}
