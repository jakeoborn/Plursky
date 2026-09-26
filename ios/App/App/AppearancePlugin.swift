import Capacitor
import UIKit

// Appearance: the native half of System / Dark / Light.
// The web layer resolves the mode (window.PlurskyAppearance in index.html:
// a pick made in Me wins; with no pick the app follows the iPhone; Dark when
// there's no signal) and calls setStyle with the RESOLVED mode. This makes
// the native chrome (sheets, pickers, alerts, the status bar) match the page,
// so a Dark pick on a light iPhone never opens a white photo picker.
// Info.plist no longer forces UIUserInterfaceStyle, so until the page calls
// this, native chrome follows the iPhone, which is what "System" means.
@objc(AppearancePlugin)
public class AppearancePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppearancePlugin"
    public let jsName = "Appearance"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setStyle", returnType: CAPPluginReturnPromise)
    ]

    @objc func setStyle(_ call: CAPPluginCall) {
        let style: UIUserInterfaceStyle = call.getString("style") == "light" ? .light : .dark
        DispatchQueue.main.async {
            for scene in UIApplication.shared.connectedScenes {
                guard let windowScene = scene as? UIWindowScene else { continue }
                for window in windowScene.windows { window.overrideUserInterfaceStyle = style }
            }
            self.bridge?.viewController?.setNeedsStatusBarAppearanceUpdate()
            call.resolve()
        }
    }
}
