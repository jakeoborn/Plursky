import Capacitor
import CoreLocation
import Foundation
import UIKit

// Set tracking, native half (SPEC-192 option B: When In Use, screen locked,
// set hours only). Design note: Plursky-private DESIGN-attendance-B.
// The page decides everything: which festival, which hours (the set windows
// from the lineup) and what a fix means (attendQualifyFixes on measured
// stages). This file only:
//   - starts a location session while the app is IN FRONT (When In Use
//     cannot start one from the background), and keeps it running with the
//     screen locked until the day's last set window ends;
//   - holds raw fixes taken INSIDE a window in a small file, excluded from
//     backup, until the page drains them (a drain returns them and deletes
//     the file; the page keeps { stageId, from, to } runs, never a coordinate).
// It never asks for Always, never monitors a region and never uses
// significant-change wakes. If iOS ends the app, counting stops until the
// user opens Plursky again. iOS shows the location indicator while it runs.
final class SetTrackEngine: NSObject, CLLocationManagerDelegate {
    static let shared = SetTrackEngine()

    private let manager = CLLocationManager()
    private var windows: [(Double, Double)] = []
    private var festivalId: String?
    private var saver = false
    private var timer: Timer?
    private(set) var tracking = false
    private var lastBufferedMs: Double = 0
    private var session: AnyObject?   // CLBackgroundActivitySession on iOS 17+

    // One fix per 20 s is plenty: a run closes only after a 5 min gap.
    private let minSpacingMs: Double = 20_000
    // The session may start this long before a window, so a phone locked in
    // the afternoon still counts the evening's sets. Between windows it runs
    // at coarse accuracy and holds nothing.
    private let leadMs: Double = 6 * 3600 * 1000
    // Below this charge (and not charging) the session ends itself.
    private let batteryFloor: Float = 0.20

    // Internal battery test (TestFlight/Xcode builds only): GPS runs as in a
    // set window, but no fix is ever written; only a count is kept.
    private(set) var testUntilMs: Double = 0
    private(set) var testFixes = 0

    private override init() {
        super.init()
        manager.delegate = self
        manager.pausesLocationUpdatesAutomatically = false
        manager.activityType = .other
        manager.distanceFilter = kCLDistanceFilterNone
    }

    var authString: String {
        switch manager.authorizationStatus {
        case .authorizedAlways: return "always"
        case .authorizedWhenInUse: return "whenInUse"
        case .denied: return "denied"
        case .restricted: return "restricted"
        default: return "notDetermined"
        }
    }
    private var authorized: Bool {
        let s = manager.authorizationStatus
        return s == .authorizedWhenInUse || s == .authorizedAlways
    }
    private var appInFront: Bool { UIApplication.shared.applicationState != .background }
    private func nowMs() -> Double { Date().timeIntervalSince1970 * 1000 }
    private func inWindow(_ ms: Double) -> Bool { windows.contains { ms >= $0.0 && ms <= $0.1 } }
    // Within lead time of a window, or inside one.
    private func inSpan(_ ms: Double) -> Bool { windows.contains { ms >= $0.0 - leadMs && ms <= $0.1 } }
    private var batteryLow: Bool {
        UIDevice.current.isBatteryMonitoringEnabled = true
        let d = UIDevice.current
        let charging = d.batteryState == .charging || d.batteryState == .full
        return d.batteryLevel >= 0 && d.batteryLevel < batteryFloor && !charging
    }

    // Called by the page while it is visible. Starting needs the app in
    // front; once running, the session survives a locked screen.
    func arm(festivalId fid: String, windows ws: [(Double, Double)], saver sv: Bool) {
        festivalId = fid; windows = ws; saver = sv
        evaluate(canStart: appInFront)
    }

    // Ends the festival session and deletes held fixes. A running battery
    // test (internal builds) is left to finish or be stopped on its own.
    func disarm() {
        festivalId = nil; windows = []
        clear()
        evaluate(canStart: false)
    }

    func startTest(minutes: Double) {
        testUntilMs = nowMs() + minutes * 60_000
        testFixes = 0
        evaluate(canStart: appInFront)
    }
    func stopTest() { testUntilMs = 0; evaluate(canStart: false) }
    private var testing: Bool { testUntilMs > nowMs() }

    // The one decision. Track iff authorized (When In Use is enough), the
    // battery is above the floor, and either a battery test is running or
    // the page armed a festival and now is within the day's set span.
    private func evaluate(canStart: Bool) {
        let now = nowMs()
        let want = authorized && !batteryLow && (testing || (festivalId != nil && inSpan(now)))
        if want, !tracking, canStart { startTracking() }
        if !want { stopTracking() }
        if tracking { applyAccuracy(now) }
        timer?.invalidate(); timer = nil
        if tracking {
            timer = Timer.scheduledTimer(withTimeInterval: 60, repeats: false) { [weak self] _ in
                self?.evaluate(canStart: false)
            }
        }
    }

    // Best accuracy inside a window (100 m in battery saver); coarse between
    // windows, only to keep the session alive.
    private func applyAccuracy(_ now: Double) {
        if testing || inWindow(now) {
            manager.desiredAccuracy = saver ? kCLLocationAccuracyHundredMeters : kCLLocationAccuracyBest
        } else {
            manager.desiredAccuracy = kCLLocationAccuracyThreeKilometers
        }
    }

    private func startTracking() {
        guard !tracking else { return }
        tracking = true
        manager.allowsBackgroundLocationUpdates = true
        manager.showsBackgroundLocationIndicator = true
        if #available(iOS 17.0, *) { session = CLBackgroundActivitySession() }
        manager.startUpdatingLocation()
    }

    private func stopTracking() {
        guard tracking else { return }
        tracking = false
        timer?.invalidate(); timer = nil
        manager.stopUpdatingLocation()
        manager.allowsBackgroundLocationUpdates = false
        if #available(iOS 17.0, *) { (session as? CLBackgroundActivitySession)?.invalidate() }
        session = nil
    }

    // MARK: CLLocationManagerDelegate

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        evaluate(canStart: false)
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard tracking, let loc = locations.last, loc.horizontalAccuracy >= 0 else { return }
        let now = nowMs()
        let ms = loc.timestamp.timeIntervalSince1970 * 1000
        if testing { testFixes += 1; return }
        // Outside every window nothing is written.
        guard inWindow(ms), ms - lastBufferedMs >= minSpacingMs else { return }
        lastBufferedMs = ms
        append(["lat": loc.coordinate.latitude, "lng": loc.coordinate.longitude,
                "accuracy": loc.horizontalAccuracy, "timestamp": ms, "atMs": now,
                "festivalId": festivalId ?? ""])
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {}

    // MARK: held fixes (until the page drains them)

    private var bufferURL: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("SetTrack", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        var d = dir
        var rv = URLResourceValues(); rv.isExcludedFromBackup = true
        try? d.setResourceValues(rv)
        return dir.appendingPathComponent("fixes.jsonl")
    }

    private func append(_ fix: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: fix) else { return }
        let url = bufferURL
        if !FileManager.default.fileExists(atPath: url.path) {
            FileManager.default.createFile(atPath: url.path, contents: nil,
                                           attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
        }
        guard let h = try? FileHandle(forWritingTo: url) else { return }
        defer { try? h.close() }
        _ = try? h.seekToEnd()
        try? h.write(contentsOf: data + Data([0x0A]))
    }

    private func readBuffer() -> [[String: Any]] {
        guard let text = try? String(contentsOf: bufferURL, encoding: .utf8) else { return [] }
        return text.split(separator: "\n").compactMap {
            (try? JSONSerialization.jsonObject(with: Data($0.utf8))) as? [String: Any]
        }
    }

    // Returns every held fix and deletes the file: after a drain the phone
    // holds no coordinate.
    func drain() -> [[String: Any]] {
        let fixes = readBuffer()
        clear()
        return fixes
    }
    func clear() { try? FileManager.default.removeItem(at: bufferURL) }
    var heldCount: Int { readBuffer().count }
    var armedFestival: String? { festivalId }
}

@objc(SetTrackPlugin)
public class SetTrackPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SetTrackPlugin"
    public let jsName = "SetTrack"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "arm", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disarm", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "drain", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "testStart", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "testStop", returnType: CAPPluginReturnPromise),
    ]

    // The battery test exists only in internal builds, by the same rule as
    // ShazamPlugin.buildChannel (the Live check-in trial gate): Xcode (DEBUG)
    // and TestFlight (sandbox receipt). An App Store build reports false and
    // testStart rejects, whatever the page asks.
    private var internalBuild: Bool {
        #if DEBUG
        return true
        #else
        return Bundle.main.appStoreReceiptURL?.lastPathComponent == "sandboxReceipt"
        #endif
    }

    @objc func status(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let e = SetTrackEngine.shared
            call.resolve(["auth": e.authString, "tracking": e.tracking,
                          "festivalId": e.armedFestival ?? NSNull(), "held": e.heldCount,
                          "internal": self.internalBuild,
                          "testUntil": e.testUntilMs, "testFixes": e.testFixes])
        }
    }

    // { festivalId, windows: [{ from, to }] (epoch ms), saver }
    @objc func arm(_ call: CAPPluginCall) {
        guard let fid = call.getString("festivalId"), let raw = call.getArray("windows") as? [[String: Any]] else {
            call.reject("festivalId and windows are required"); return
        }
        let ws: [(Double, Double)] = raw.compactMap { w in
            guard let f = (w["from"] as? NSNumber)?.doubleValue, let t = (w["to"] as? NSNumber)?.doubleValue, t > f else { return nil }
            return (f, t)
        }
        let saver = call.getBool("saver") ?? false
        DispatchQueue.main.async {
            SetTrackEngine.shared.arm(festivalId: fid, windows: ws, saver: saver)
            call.resolve(["auth": SetTrackEngine.shared.authString, "tracking": SetTrackEngine.shared.tracking])
        }
    }

    @objc func disarm(_ call: CAPPluginCall) {
        DispatchQueue.main.async { SetTrackEngine.shared.disarm(); call.resolve() }
    }

    @objc func drain(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let e = SetTrackEngine.shared
            call.resolve(["festivalId": e.armedFestival ?? NSNull(), "fixes": e.drain()])
        }
    }

    @objc func clear(_ call: CAPPluginCall) {
        DispatchQueue.main.async { SetTrackEngine.shared.clear(); call.resolve() }
    }

    @objc func testStart(_ call: CAPPluginCall) {
        guard internalBuild else { call.reject("not available in this build"); return }
        let minutes = max(1, min(180, call.getDouble("minutes") ?? 60))
        DispatchQueue.main.async {
            SetTrackEngine.shared.startTest(minutes: minutes)
            call.resolve(["tracking": SetTrackEngine.shared.tracking, "testUntil": SetTrackEngine.shared.testUntilMs])
        }
    }

    @objc func testStop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let n = SetTrackEngine.shared.testFixes
            SetTrackEngine.shared.stopTest()
            call.resolve(["testFixes": n])
        }
    }
}
