// ocr-vision.swift — read one official schedule graphic on macOS with no
// install, printing one JSON line per text line or run:
//   {"t":"MAX MCNOWN","x":..,"y":..,"w":..,"h":..,"c":0.99}
// Coordinates are pixels, origin TOP-left. This produces CANDIDATES only; a
// human-checked review manifest decides what becomes data.
//
//   swift scripts/historical/ocr-vision.swift <image.png>
//   swift scripts/historical/ocr-vision.swift <schedule.pdf> <page>
//
// An image is read with the Vision framework. A PDF (sniffed by its "%PDF"
// header, since cached files carry no extension) is read one page at a time,
// numbered from 1: its own text layer when it has one, placed by PDFKit's
// character boxes and split into runs wherever a gap is wider than a word
// space, so stage columns that share a baseline stay apart ("c" is 1 and
// "src" is "pdf-text"). A page with no text layer is drawn at 2x and read by
// Vision. Either way the coordinates are those of the page drawn at 2x.
import Foundation
import Vision
import AppKit
import PDFKit

func fail(_ msg: String) -> Never {
  FileHandle.standardError.write("\(msg)\n".data(using: .utf8)!); exit(1)
}

func emit(_ rec: [String: Any]) {
  let d = try! JSONSerialization.data(withJSONObject: rec, options: [.sortedKeys])
  print(String(data: d, encoding: .utf8)!)
}

func ocr(_ cg: CGImage) {
  let W = Double(cg.width), H = Double(cg.height)
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = .accurate
  req.usesLanguageCorrection = false
  req.minimumTextHeight = 0.004
  do { try VNImageRequestHandler(cgImage: cg, options: [:]).perform([req]) } catch { fail("vision: \(error)") }
  for o in (req.results ?? []) {
    guard let c = o.topCandidates(1).first else { continue }
    let b = o.boundingBox
    emit(["t": c.string, "x": Int(b.minX * W), "y": Int((1 - b.maxY) * H),
          "w": Int(b.width * W), "h": Int(b.height * H), "c": Double(c.confidence)])
  }
}

let args = CommandLine.arguments
guard args.count >= 2 else { fail("usage: ocr-vision <image|pdf> [page]") }
let path = args[1]
guard let data = FileManager.default.contents(atPath: path) else { fail("cannot read \(path)") }

if data.starts(with: Array("%PDF".utf8)) {
  guard let doc = PDFDocument(data: data) else { fail("cannot open PDF \(path)") }
  let pageArg = args.count >= 3 ? args[2] : "1"
  let pageNo = Int(pageArg) ?? 0
  guard pageNo >= 1, pageNo <= doc.pageCount, let page = doc.page(at: pageNo - 1) else {
    fail("page \(pageArg) is not in \(path) (\(doc.pageCount) pages)")
  }
  let box = page.bounds(for: .mediaBox)
  let s: CGFloat = 2
  let text = (page.string ?? "") as NSString
  var runs = 0
  var cur = "", curR = CGRect.null, lastR = CGRect.null
  func flush() {
    let t = cur.trimmingCharacters(in: .whitespacesAndNewlines)
    if !t.isEmpty && !curR.isNull {
      emit(["t": t, "x": Int((curR.minX - box.minX) * s), "y": Int((box.maxY - curR.maxY) * s),
            "w": Int(curR.width * s), "h": Int(curR.height * s), "c": 1.0, "src": "pdf-text"])
      runs += 1
    }
    cur = ""; curR = .null; lastR = .null
  }
  for i in 0..<text.length {
    let ch = text.substring(with: NSRange(location: i, length: 1))
    if ch.rangeOfCharacter(from: .newlines) != nil { flush(); continue }
    let r = page.characterBounds(at: i)
    if ch.trimmingCharacters(in: .whitespaces).isEmpty || r.isNull || r.isEmpty {
      if !cur.isEmpty && !cur.hasSuffix(" ") { cur += " " }
      continue
    }
    if !lastR.isNull {
      let em = max(r.height, lastR.height)
      // A new baseline, a step back to the left or a gap wider than a word
      // space starts a new run.
      if abs(r.midY - lastR.midY) > em * 0.5 || r.minX < lastR.minX - 0.5 || r.minX - lastR.maxX > em * 0.8 { flush() }
    }
    cur += ch; curR = curR.union(r); lastR = r
  }
  flush()
  if runs == 0 {
    let img = page.thumbnail(of: NSSize(width: box.width * s, height: box.height * s), for: .mediaBox)
    guard let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { fail("cannot draw page \(pageNo) of \(path)") }
    ocr(cg)
  }
} else {
  guard let img = NSImage(data: data),
        let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { fail("cannot read \(path)") }
  ocr(cg)
}
