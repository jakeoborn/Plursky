import AVFoundation
import Capacitor
import ImageIO
import Photos
import UniformTypeIdentifiers

// "Scan my weekend": find every photo and video taken during the festival's
// nights straight from the photo library, instead of the user hand-picking
// them in PHPicker.
// Why not the picker: PHPicker hands back copies with the location stripped
// unless the app has full library access, caps a pick at 50, and makes the
// user find the right days themselves. PhotoKit gives the capture instant
// (a real UTC time, no timezone guessing) and the GPS fix straight from the
// asset, so the web layer can tag each item to a set without reading EXIF.
//
// The web layer decides which nights to ask for and does all the tagging;
// this plugin only lists assets and writes one at a time to a file the
// WebView can read, so a weekend of video never sits in memory at once.
@objc(PhotoScanPlugin)
public class PhotoScanPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PhotoScanPlugin"
    public let jsName = "PhotoScan"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestAccess", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scan", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "export", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "discard", returnType: CAPPluginReturnPromise)
    ]

    private static func statusName(_ status: PHAuthorizationStatus) -> String {
        switch status {
        case .authorized: return "authorized"
        case .limited: return "limited"
        case .denied: return "denied"
        case .restricted: return "restricted"
        case .notDetermined: return "notDetermined"
        @unknown default: return "unknown"
        }
    }

    private static func canRead(_ status: PHAuthorizationStatus) -> Bool {
        return status == .authorized || status == .limited
    }

    // Exports land here. Caches, not tmp: a video's file is kept so song
    // recognition can read it later (the moment stores its path), and tmp is
    // cleared more eagerly. Images are discarded once imported.
    private static func exportDir() -> URL {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        let dir = caches.appendingPathComponent("plursky-scan", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    // Shows the system prompt only when access has never been asked for.
    // "limited" is a valid answer: the scan then sees only the photos the
    // user chose to share, and the web layer says so.
    @objc func requestAccess(_ call: CAPPluginCall) {
        let current = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        if current != .notDetermined {
            call.resolve(["status": Self.statusName(current)])
            return
        }
        PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
            call.resolve(["status": Self.statusName(status)])
        }
    }

    // Lists photos and videos created between startMs and endMs (UTC epoch
    // ms), oldest first. Screenshots are left out: a screenshot of the
    // schedule is not a moment from a set.
    @objc func scan(_ call: CAPPluginCall) {
        guard let startMs = call.getDouble("startMs"), let endMs = call.getDouble("endMs"), endMs > startMs else {
            call.reject("startMs and endMs are required", "bad_range")
            return
        }
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        guard Self.canRead(status) else {
            call.resolve(["status": Self.statusName(status), "assets": []])
            return
        }
        DispatchQueue.global(qos: .userInitiated).async {
            let options = PHFetchOptions()
            options.predicate = NSPredicate(
                format: "creationDate >= %@ AND creationDate <= %@ AND (mediaType == %d OR mediaType == %d)",
                Date(timeIntervalSince1970: startMs / 1000) as NSDate,
                Date(timeIntervalSince1970: endMs / 1000) as NSDate,
                PHAssetMediaType.image.rawValue,
                PHAssetMediaType.video.rawValue
            )
            options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: true)]
            let result = PHAsset.fetchAssets(with: options)
            var assets: [[String: Any]] = []
            var screenshots = 0
            result.enumerateObjects { asset, _, _ in
                guard let created = asset.creationDate else { return }
                if asset.mediaSubtypes.contains(.photoScreenshot) { screenshots += 1; return }
                var row: [String: Any] = [
                    "id": asset.localIdentifier,
                    "mediaType": asset.mediaType == .video ? "video" : "image",
                    "createdMs": created.timeIntervalSince1970 * 1000,
                    "duration": asset.duration
                ]
                if let loc = asset.location {
                    row["lat"] = loc.coordinate.latitude
                    row["lng"] = loc.coordinate.longitude
                    if loc.horizontalAccuracy >= 0 { row["acc"] = loc.horizontalAccuracy }
                }
                if let resource = PHAssetResource.assetResources(for: asset).first {
                    row["name"] = resource.originalFilename
                }
                assets.append(row)
            }
            call.resolve(["status": Self.statusName(status), "assets": assets, "screenshotsSkipped": screenshots])
        }
    }

    // Writes one asset to a file and returns its file URL. Photos still in
    // iCloud are downloaded first (isNetworkAccessAllowed), which is the
    // other thing the picker could not do.
    @objc func export(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else {
            call.reject("id is required", "bad_id")
            return
        }
        guard Self.canRead(PHPhotoLibrary.authorizationStatus(for: .readWrite)) else {
            call.reject("No photo library access", "no_access")
            return
        }
        guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject else {
            call.reject("That photo is no longer in the library", "not_found")
            return
        }
        let base = id.replacingOccurrences(of: "/", with: "_")
        let name = PHAssetResource.assetResources(for: asset).first?.originalFilename
        if asset.mediaType == .video {
            exportVideo(asset, base: base, name: name, call: call)
        } else {
            exportImage(asset, base: base, name: name, call: call)
        }
    }

    // Removes a file this plugin exported. Refuses any path outside its own
    // folder, so the web layer can never delete anything else with it.
    @objc func discard(_ call: CAPPluginCall) {
        guard let path = call.getString("path"), let url = URL(string: path), url.isFileURL else {
            call.reject("path is required", "bad_path")
            return
        }
        let dir = Self.exportDir().standardizedFileURL.path
        let target = url.standardizedFileURL.path
        guard target.hasPrefix(dir + "/") else {
            call.reject("Not a scan export", "bad_path")
            return
        }
        try? FileManager.default.removeItem(at: url)
        call.resolve()
    }

    private func exportImage(_ asset: PHAsset, base: String, name: String?, call: CAPPluginCall) {
        let options = PHImageRequestOptions()
        options.isNetworkAccessAllowed = true
        options.deliveryMode = .highQualityFormat
        options.version = .current
        PHImageManager.default().requestImageDataAndOrientation(for: asset, options: options) { data, _, _, info in
            guard let data = data, let source = CGImageSourceCreateWithData(data as CFData, nil) else {
                let err = info?[PHImageErrorKey] as? Error
                call.reject(err.map { String(describing: $0) } ?? "Couldn't read that photo", "unreadable")
                return
            }
            // HEIC becomes JPEG, the format the web layer can decode and
            // store. AddImageFromSource carries the EXIF across.
            let url = Self.exportDir().appendingPathComponent(base + ".jpg")
            try? FileManager.default.removeItem(at: url)
            guard let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else {
                call.reject("Couldn't convert that photo", "convert_failed")
                return
            }
            let props: [CFString: Any] = [kCGImageDestinationLossyCompressionQuality: 0.9]
            CGImageDestinationAddImageFromSource(dest, source, 0, props as CFDictionary)
            guard CGImageDestinationFinalize(dest) else {
                call.reject("Couldn't convert that photo", "convert_failed")
                return
            }
            let jpgName = ((name ?? base) as NSString).deletingPathExtension + ".jpg"
            call.resolve(["path": url.absoluteString, "mimeType": "image/jpeg", "name": jpgName])
        }
    }

    private func exportVideo(_ asset: PHAsset, base: String, name: String?, call: CAPPluginCall) {
        let options = PHVideoRequestOptions()
        options.isNetworkAccessAllowed = true
        options.deliveryMode = .highQualityFormat
        options.version = .current
        PHImageManager.default().requestAVAsset(forVideo: asset, options: options) { avAsset, _, info in
            // An ordinary clip is a file already: copy it as it is.
            if let urlAsset = avAsset as? AVURLAsset {
                let ext = urlAsset.url.pathExtension.isEmpty ? "mov" : urlAsset.url.pathExtension.lowercased()
                let url = Self.exportDir().appendingPathComponent(base + "." + ext)
                do {
                    try? FileManager.default.removeItem(at: url)
                    try FileManager.default.copyItem(at: urlAsset.url, to: url)
                } catch {
                    call.reject(String(describing: error), "copy_failed")
                    return
                }
                let mime = ext == "mp4" || ext == "m4v" ? "video/mp4" : "video/quicktime"
                call.resolve(["path": url.absoluteString, "mimeType": mime, "name": name ?? (base + "." + ext)])
                return
            }
            // Slow motion and edited clips come back as a composition, which
            // has to be rendered to a file. Passthrough keeps the codec.
            guard let avAsset = avAsset,
                  let session = AVAssetExportSession(asset: avAsset, presetName: AVAssetExportPresetPassthrough) else {
                let err = info?[PHImageErrorKey] as? Error
                call.reject(err.map { String(describing: $0) } ?? "Couldn't read that video", "unreadable")
                return
            }
            let url = Self.exportDir().appendingPathComponent(base + ".mov")
            try? FileManager.default.removeItem(at: url)
            session.outputURL = url
            session.outputFileType = .mov
            session.exportAsynchronously {
                if session.status == .completed {
                    let movName = ((name ?? base) as NSString).deletingPathExtension + ".mov"
                    call.resolve(["path": url.absoluteString, "mimeType": "video/quicktime", "name": movName])
                } else {
                    call.reject(session.error.map { String(describing: $0) } ?? "Couldn't export that video", "export_failed")
                }
            }
        }
    }
}
