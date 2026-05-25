import Capacitor
import ShazamKit

@objc(ShazamPlugin)
public class ShazamPlugin: CAPPlugin, CAPBridgedPlugin, SHSessionDelegate {
    public let identifier = "ShazamPlugin"
    public let jsName = "ShazamPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "identify", returnType: CAPPluginReturnPromise)
    ]

    private var session: SHSession?
    private var audioEngine: AVAudioEngine?
    private var savedCall: CAPPluginCall?

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
            savedCall?.resolve(["matched": false, "title": "", "artist": ""])
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
        savedCall?.resolve(["matched": false, "title": "", "artist": ""])
        savedCall = nil
    }
}
