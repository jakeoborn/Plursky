import Capacitor
import UIKit
import WebKit

final class PlurskyBridgeViewController: CAPBridgeViewController {
    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        let args = ProcessInfo.processInfo.arguments
        let env = ProcessInfo.processInfo.environment
        let params = PlurskyBridgeViewController.qaParams(arguments: args, environment: env)

        if !params.isEmpty {
            let query = params
                .map { key, value in "\(key)=\(value)" }
                .joined(separator: "&")
            let script = """
            (function() {
              try {
                window.__PLURSKY_QA_PARAMS__ = '\(query)';
                if (!window.location.search) {
                  history.replaceState(null, '', window.location.pathname + '?' + '\(query)' + window.location.hash);
                }
              } catch (e) {}
            })();
            """
            let userScript = WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true)
            configuration.userContentController.addUserScript(userScript)
        }

        return configuration
    }

    private static func qaParams(arguments: [String], environment: [String: String]) -> [(String, String)] {
        var params: [(String, String)] = []

        if value(for: "-plurskyQAMode", in: arguments, environmentKey: "PLURSKY_QA_MODE", environment: environment) == "1" {
            params.append(("qaMode", "1"))
        }

        if let seed = value(for: "-plurskyQASeed", in: arguments, environmentKey: "PLURSKY_QA_SEED", environment: environment), !seed.isEmpty {
            params.append(("qaSeed", escape(seed)))
        }

        if let tab = value(for: "-plurskyInitialTab", in: arguments, environmentKey: "PLURSKY_INITIAL_TAB", environment: environment), !tab.isEmpty {
            params.append(("tab", escape(tab)))
        }

        return params
    }

    private static func value(for flag: String, in arguments: [String], environmentKey: String, environment: [String: String]) -> String? {
        if let index = arguments.firstIndex(of: flag), arguments.indices.contains(index + 1) {
            return arguments[index + 1]
        }
        return environment[environmentKey]
    }

    private static func escape(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? value
    }
}
