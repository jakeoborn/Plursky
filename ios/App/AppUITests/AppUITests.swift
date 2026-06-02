import XCTest

final class AppUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testLaunchAndCaptureHome() throws {
        let app = XCUIApplication()
        app.launchArguments += ["-plurskyInitialTab", "home"]
        app.launch()

        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 20), "Plursky did not reach foreground")
        capture("01-launch")

        let webView = app.webViews.firstMatch
        XCTAssertTrue(webView.waitForExistence(timeout: 15), "Plursky web view did not mount")
        capture("02-mounted")
    }

    private func capture(_ name: String) {
        let screenshot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
