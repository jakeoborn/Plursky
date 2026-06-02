import Capacitor
import ShazamKit

@objc(ShazamPlugin)
public class ShazamPlugin: CAPPlugin, CAPBridgedPlugin, SHSessionDelegate {
    public let identifier = "ShazamPlugin"
    public let jsName = "ShazamPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "identify", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "identifyFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "identifyBase64", returnType: CAPPluginReturnPromise)
    ]

    private var session: SHSession?
    private var audioEngine: AVAudioEngine?
    private var savedCall: CAPPluginCall?

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
        let url = URL(fileURLWithPath: path.replacingOccurrences(of: "file://", with: ""))
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

    @objc func identify(_ call: CAPPluginCall) {
        savedCall = call

        session = SHSession()
        session?.delegate = self
        audioEngine = AVAudioEngine()

        let inputNode = audioEngine!.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)

        inputNode.installTap(onBus: 0, bufferSize: 2048, format: recordingFormat) { [weak self] buffer, _ in
            self?.session?.matchStreamingBuffer(buffer, at: nil)
        }

        do {
            try AVAudioSession.sharedInstance().setCategory(.record, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
            try audioEngine?.start()

            // Auto-stop after 12 seconds if no match
            DispatchQueue.main.asyncAfter(deadline: .now() + 12) { [weak self] in
                self?.stopListening()
                if let call = self?.savedCall {
                    call.resolve(["matched": false, "title": "", "artist": ""])
                    self?.savedCall = nil
                }
            }
        } catch {
            call.reject("Failed to start audio: \(error.localizedDescription)")
        }
    }

    private func stopListening() {
        audioEngine?.inputNode.removeTap(onBus: 0)
        audioEngine?.stop()
        try? AVAudioSession.sharedInstance().setActive(false)
    }

    // MARK: - SHSessionDelegate

    public func session(_ session: SHSession, didFind match: SHMatch) {
        stopListening()
        guard let item = match.mediaItems.first else {
            savedCall?.resolve(["matched": false, "title": "", "artist": "", "debug": ["reason": "empty-match"]])
            savedCall = nil
            return
        }
        savedCall?.resolve([
            "matched": true,
            "title": item.title ?? "",
            "artist": item.artist ?? "",
            "appleMusicID": item.appleMusicID ?? "",
            "artworkURL": item.artworkURL?.absoluteString ?? "",
        ])
        savedCall = nil
    }

    public func session(_ session: SHSession, didNotFindMatchFor signature: SHSignature, error: (any Error)?) {
        stopListening()
        savedCall?.resolve(["matched": false, "title": "", "artist": "", "debug": ["reason": "did-not-find", "error": error?.localizedDescription ?? ""]])
        savedCall = nil
    }
}
