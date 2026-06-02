import XCTest

final class AppUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testMemoriesSmokeFlow() throws {
        let app = XCUIApplication()
        app.launchArguments += [
            "-plurskyQAMode", "1",
            "-plurskyQASeed", "memories",
            "-plurskyInitialTab", "memories"
        ]
        app.launch()

        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 20), "Plursky did not reach foreground")
        capture("01-launch")

        let webView = app.webViews.firstMatch
        let anyAppSurface = NSPredicate(format: "exists == true")
        expectation(for: anyAppSurface, evaluatedWith: webView)
        waitForExpectations(timeout: 10)

        XCTAssertFalse(app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] %@", "WELCOME")).firstMatch.exists, "Onboarding was not bypassed")
        capture("02-memories")

        tapLabelContaining("GRID", in: app)
        capture("03-grid")

        tapLabelContaining("STORY", in: app)
        capture("04-story")

        tapLabelContaining("NIGHT", in: app)
        capture("05-night")

        tapLabelContaining("MAP", in: app)
        capture("06-map")
    }

    private func tapLabelContaining(_ label: String, in app: XCUIApplication) {
        let predicate = NSPredicate(format: "label CONTAINS[c] %@", label)
        let element = app.buttons.matching(predicate).firstMatch.exists
            ? app.buttons.matching(predicate).firstMatch
            : app.staticTexts.matching(predicate).firstMatch
        if element.waitForExistence(timeout: 5) {
            element.tap()
        }
    }

    private func capture(_ name: String) {
        let screenshot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
