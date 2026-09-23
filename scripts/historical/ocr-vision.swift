// ocr-vision.swift — OCR one schedule graphic with macOS's built-in Vision
// framework (no install), printing one JSON line per recognized text line:
//   {"t":"MAX MCNOWN","x":..,"y":..,"w":..,"h":..,"c":0.99}
// Coordinates are pixels, origin TOP-left. This produces CANDIDATES only; a
// human-checked review manifest decides what becomes data.
//
//   swift scripts/historical/ocr-vision.swift <image.png>
import Foundation
import Vision
import AppKit

let path = CommandLine.arguments[1]
guard let img = NSImage(contentsOfFile: path),
      let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
  FileHandle.standardError.write("cannot read \(path)\n".data(using: .utf8)!); exit(1)
}
let W = Double(cg.width), H = Double(cg.height)
let req = VNRecognizeTextRequest()
req.recognitionLevel = .accurate
req.usesLanguageCorrection = false
req.minimumTextHeight = 0.004
try VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
for o in (req.results ?? []) {
  guard let c = o.topCandidates(1).first else { continue }
  let b = o.boundingBox
  let rec: [String: Any] = ["t": c.string, "x": Int(b.minX * W), "y": Int((1 - b.maxY) * H),
                            "w": Int(b.width * W), "h": Int(b.height * H), "c": Double(c.confidence)]
  let d = try JSONSerialization.data(withJSONObject: rec, options: [.sortedKeys])
  print(String(data: d, encoding: .utf8)!)
}
