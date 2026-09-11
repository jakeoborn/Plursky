import Capacitor
import ShazamKit
import UIKit

@objc(ShazamPlugin)
public class ShazamPlugin: CAPPlugin, CAPBridgedPlugin, SHSessionDelegate {
    public let identifier = "ShazamPlugin"
    public let jsName = "ShazamPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "identify", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "buildChannel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "identifyFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "identifyBase64", returnType: CAPPluginReturnPromise)
    ]

    // File/base64 recognition state.
    private var session: SHSession?
    private var savedCall: CAPPluginCall?

    // Live-mic recognition state. Touched on the main queue only, so a match,
    // the 12 s timeout, Cancel and an interruption can race without two of
    // them resolving the same call or one attempt's timer stopping the next.
    private var liveCall: CAPPluginCall?
    private var liveSession: SHSession?
    private var audioEngine: AVAudioEngine?
    private var liveTimeout: DispatchWorkItem?
    private var liveObservers: [NSObjectProtocol] = []

    // Release builds log nothing: no song, no artist, no location.
    private func logDebug(_ message: @autoclosure () -> String) {
        #if DEBUG
        print("⚡️[Shazam] \(message())")
        #endif
    }

    private func noMatch(_ reason: String, _ extra: [String: Any] = [:]) -> [String: Any] {
        var debug = extra
        debug["reason"] = reason
        return ["matched": false, "title": "", "artist": "", "debug": debug]
    }

    // Which build is running, for gating TestFlight-only trials. A debug
    // build says "debug"; a TestFlight install carries a sandbox receipt; an
    // App Store install does not. JS treats anything it can't read as off.
    @objc func buildChannel(_ call: CAPPluginCall) {
        #if DEBUG
        call.resolve(["channel": "debug"])
        #else
        let sandbox = Bundle.main.appStoreReceiptURL?.lastPathComponent == "sandboxReceipt"
        call.resolve(["channel": sandbox ? "testflight" : "appstore"])
        #endif
    }

    // Identify a song from a recorded video/audio FILE rather than the live
    // mic. This is the retroactive-Shazam path: the audio you already
    // captured in a festival video becomes the recognition sample, so the
    // song tag goes from "estimated from tracklist" to "proven from your
    // own recording". Reads the file's audio track in PCM chunks and feeds
    // them to the same SHSession streaming matcher.
    @objc func identifyFile(_ call: CAPPluginCall) {
        guard let path = call.getString("path") else {
            call.reject("Missing file path"); return
        }
        let url = URL(string: path)?.isFileURL == true
            ? URL(string: path)!
            : URL(fileURLWithPath: path.replacingOccurrences(of: "file://", with: ""))
        matchFromURL(url, call: call, tempURL: nil)
    }

    // Identify from base64-encoded media — lets the JS side hand over a video
    // blob straight from IndexedDB without the Filesystem plugin. We write it
    // to a temp file, run the same matcher, then delete the temp file.
    @objc func identifyBase64(_ call: CAPPluginCall) {
        guard let b64 = call.getString("data"), let data = Data(base64Encoded: b64) else {
            call.reject("Missing or invalid base64 data"); return
        }
        let ext = call.getString("ext") ?? "mp4"
        let tmp = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("shazam-\(UUID().uuidString).\(ext)")
        do { try data.write(to: tmp) } catch { call.reject("Failed to write temp file"); return }
        matchFromURL(tmp, call: call, tempURL: tmp)
    }

    private func resolveNoMatch(_ debug: [String: Any] = [:]) {
        logDebug("NO MATCH (file path) · \(debug["reason"] ?? "")")
        DispatchQueue.main.async {
            self.savedCall?.resolve(["matched": false, "title": "", "artist": "", "debug": debug])
            self.savedCall = nil
        }
    }

    // Shared file→PCM→matcher path. Deletes tempURL (if any) once the audio
    // track has been read.
    //
    // We accumulate the WHOLE clip into a single SHSignature via
    // SHSignatureGenerator and then match it once, instead of pumping each PCM
    // buffer into matchStreamingBuffer(_:at:nil). That streaming call is built
    // for real-time mic input; feeding a whole file through it as fast as the
    // reader yields, with a nil timestamp, stamps every buffer at "now" and
    // collapses the signature's timeline — so the matcher effectively only ever
    // sees a sliver of audio and almost always returns no-match on a real clip.
    // The signature-generator path is Apple's intended way to recognise a
    // pre-recorded file and gives the matcher the full, correctly-timed sample.
    private func matchFromURL(_ url: URL, call: CAPPluginCall, tempURL: URL?) {
        savedCall = call
        session = SHSession()
        session?.delegate = self

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }
            defer { if let t = tempURL { try? FileManager.default.removeItem(at: t) } }
            let asset = AVURLAsset(url: url)
            let fileBytes = (try? FileManager.default.attributesOfItem(atPath: url.path)[.size] as? NSNumber)?.intValue ?? 0
            var debug: [String: Any] = [
                "fileBytes": fileBytes,
                "durationSeconds": CMTimeGetSeconds(asset.duration),
                "audioTrack": false,
                "sampleBuffers": 0,
                "framesAppended": 0,
            ]
            guard let track = asset.tracks(withMediaType: .audio).first,
                  let reader = try? AVAssetReader(asset: asset) else {
                debug["reason"] = "no-audio-track-or-reader"
                self.resolveNoMatch(debug); return
            }
            debug["audioTrack"] = true
            let settings: [String: Any] = [
                AVFormatIDKey: kAudioFormatLinearPCM,
                AVLinearPCMIsFloatKey: true,
                AVLinearPCMBitDepthKey: 32,
                AVLinearPCMIsNonInterleaved: false,
                AVSampleRateKey: 44100,
                AVNumberOfChannelsKey: 1,
            ]
            let output = AVAssetReaderTrackOutput(track: track, outputSettings: settings)
            reader.add(output)
            reader.startReading()

            let fmt = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 44100, channels: 1, interleaved: false)!
            let generator = SHSignatureGenerator()
            var sampleOffset: AVAudioFramePosition = 0   // contiguous timeline
            var appended = false
            while reader.status == .reading {
                guard let sampleBuffer = output.copyNextSampleBuffer(),
                      let blockBuffer = CMSampleBufferGetDataBuffer(sampleBuffer) else { break }
                debug["sampleBuffers"] = (debug["sampleBuffers"] as? Int ?? 0) + 1
                let length = CMBlockBufferGetDataLength(blockBuffer)
                let sampleCount = CMSampleBufferGetNumSamples(sampleBuffer)
                let frameCount = AVAudioFrameCount(sampleCount > 0 ? sampleCount : length / 4)
                if frameCount > 0, let pcmBuffer = AVAudioPCMBuffer(pcmFormat: fmt, frameCapacity: frameCount) {
                    pcmBuffer.frameLength = frameCount
                    if let dst = pcmBuffer.floatChannelData?[0] {
                        CMBlockBufferCopyDataBytes(blockBuffer, atOffset: 0, dataLength: min(length, Int(frameCount) * 4), destination: dst)
                    }
                    let when = AVAudioTime(sampleTime: sampleOffset, atRate: 44100)
                    do { try generator.append(pcmBuffer, at: when); appended = true } catch { /* skip bad chunk */ }
                    sampleOffset += AVAudioFramePosition(frameCount)
                    debug["framesAppended"] = (debug["framesAppended"] as? Int ?? 0) + Int(frameCount)
                }
                CMSampleBufferInvalidate(sampleBuffer)
            }
            debug["readerStatus"] = reader.status.rawValue
            if let err = reader.error { debug["readerError"] = err.localizedDescription }
            guard appended else { debug["reason"] = "no-pcm-appended"; self.resolveNoMatch(debug); return }

            // Match the accumulated signature; didFind/didNotFind resolves the call.
            let signature = generator.signature()
            self.session?.match(signature)

            // Safety net if no delegate callback fires.
            DispatchQueue.main.asyncAfter(deadline: .now() + 8) { [weak self] in
                if let call = self?.savedCall {
                    var timedOut = debug
                    timedOut["reason"] = "match-timeout"
                    call.resolve(["matched": false, "title": "", "artist": "", "debug": timedOut])
                    self?.savedCall = nil
                }
            }
        }
    }

    // MARK: - Live mic
    //
    // Foreground only, user-initiated, at most 12 seconds. Buffers go straight
    // from the input tap into ShazamKit's matcher; nothing is written to disk
    // or kept after the attempt. Every exit — match, no match, timeout,
    // Cancel, the app resigning active, an audio interruption, a start
    // failure — goes through finishLive, which stops the engine, removes the
    // tap, deactivates the session and resolves the call exactly once.

    @objc func identify(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.startLive(call) }
    }

    // Stops a live attempt now. The pending identify() resolves with
    // cancelled: true; this call resolves with whether one was running.
    @objc func cancel(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let wasRunning = self.liveCall != nil
            self.finishLive(self.cancelled("cancelled"))
            call.resolve(["cancelled": wasRunning])
        }
    }

    private func cancelled(_ reason: String) -> [String: Any] {
        var payload = noMatch(reason)
        payload["cancelled"] = true
        return payload
    }

    private func startLive(_ call: CAPPluginCall) {
        // One live attempt at a time. A second call used to replace the saved
        // call, leaving the first promise unresolved and the first timer armed.
        if liveCall != nil {
            call.reject("A live recognition is already running", "BUSY")
            return
        }
        liveCall = call
        let audio = AVAudioSession.sharedInstance()
        switch audio.recordPermission {
        case .denied:
            finishLive(noMatch("mic-denied"))
        case .undetermined:
            // The permission alert resigns the app, so observers go on only
            // after the answer, in beginListening.
            audio.requestRecordPermission { granted in
                DispatchQueue.main.async {
                    guard self.liveCall === call else { return }
                    if granted { self.beginListening() } else { self.finishLive(self.noMatch("mic-denied")) }
                }
            }
        default:
            beginListening()
        }
    }

    private func beginListening() {
        guard let call = liveCall else { return }
        let matcher = SHSession()
        matcher.delegate = self
        liveSession = matcher
        let engine = AVAudioEngine()
        audioEngine = engine

        do {
            // Configure + ACTIVATE the audio session BEFORE querying the input
            // format. The hardware input format isn't valid until the session is
            // active in .record — querying it first (the old bug) could hand the
            // tap a stale/zero format, so ShazamKit received mismatched buffers
            // and never matched. `.measurement` disables AGC/processing so the
            // raw signal gives the cleanest signature (important in a loud crowd).
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.record, mode: .measurement, options: [.duckOthers])
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

            let inputNode = engine.inputNode
            let recordingFormat = inputNode.outputFormat(forBus: 0)
            // A zero format (no input route) makes installTap raise an
            // Objective-C exception Swift cannot catch.
            guard recordingFormat.sampleRate > 0, recordingFormat.channelCount > 0 else {
                failLive(call, code: "NO_INPUT"); return
            }
            // Pass the tap's real AVAudioTime (`when`) instead of nil. nil stamps
            // every buffer at "now", collapsing the stream timeline so the matcher
            // only ever sees a sliver — the same nil-timestamp bug already fixed on
            // the file path. The running `when` keeps a coherent continuous stream.
            inputNode.removeTap(onBus: 0)
            inputNode.installTap(onBus: 0, bufferSize: 2048, format: recordingFormat) { [weak matcher] buffer, when in
                matcher?.matchStreamingBuffer(buffer, at: when)
            }
            engine.prepare()
            try engine.start()
        } catch {
            logDebug("MIC-ERROR · \(error.localizedDescription)")
            failLive(call, code: "AUDIO_START")
            return
        }

        // Leaving the app — backgrounding, a call, Control Center — stops the
        // mic immediately. No background audio mode exists to keep it alive.
        let center = NotificationCenter.default
        liveObservers = [
            center.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in
                guard let self = self else { return }
                self.finishLive(self.cancelled("backgrounded"))
            },
            center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] _ in
                guard let self = self else { return }
                self.finishLive(self.cancelled("interrupted"))
            },
        ]

        // A work item, not a bare asyncAfter, so a finished attempt's timer is
        // cancelled and can never stop the attempt after it.
        let timeout = DispatchWorkItem { [weak self] in
            guard let self = self else { return }
            self.logDebug("MIC-TIMEOUT")
            self.finishLive(self.noMatch("mic-timeout"))
        }
        liveTimeout = timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + 12, execute: timeout)
        logDebug("START live mic")
    }

    private func failLive(_ call: CAPPluginCall, code: String) {
        guard liveCall === call else { return }
        teardownLive()
        call.reject("Failed to start audio", code)
    }

    private func finishLive(_ payload: [String: Any]) {
        guard let call = liveCall else { return }
        teardownLive()
        call.resolve(payload)
    }

    private func teardownLive() {
        liveCall = nil
        liveTimeout?.cancel()
        liveTimeout = nil
        for o in liveObservers { NotificationCenter.default.removeObserver(o) }
        liveObservers = []
        if let engine = audioEngine {
            engine.inputNode.removeTap(onBus: 0)
            engine.stop()
        }
        audioEngine = nil
        liveSession?.delegate = nil
        liveSession = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    // MARK: - SHSessionDelegate

    public func session(_ session: SHSession, didFind match: SHMatch) {
        var payload: [String: Any] = noMatch("empty-match")
        if let item = match.mediaItems.first {
            payload = [
                "matched": true,
                "title": item.title ?? "",
                "artist": item.artist ?? "",
                "appleMusicID": item.appleMusicID ?? "",
                "artworkURL": item.artworkURL?.absoluteString ?? "",
            ]
        }
        logDebug("MATCH · \(match.mediaItems.first?.artist ?? "?") — \(match.mediaItems.first?.title ?? "?")")
        DispatchQueue.main.async { self.deliver(payload, from: session) }
    }

    public func session(_ session: SHSession, didNotFindMatchFor signature: SHSignature, error: (any Error)?) {
        logDebug("DID-NOT-FIND · \(error?.localizedDescription ?? "no-error")")
        let payload = noMatch("did-not-find", ["error": error?.localizedDescription ?? ""])
        DispatchQueue.main.async { self.deliver(payload, from: session) }
    }

    private func deliver(_ payload: [String: Any], from session: SHSession) {
        if session === liveSession { finishLive(payload); return }
        guard session === self.session else { return }
        savedCall?.resolve(payload)
        savedCall = nil
    }
}
