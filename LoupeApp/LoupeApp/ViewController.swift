import UIKit
import WebKit
import CoreLocation
import CoreMotion

// MARK: - Custom URL Scheme Handler
class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let bundleURL = Bundle.main.resourceURL else {
            urlSchemeTask.didFailWithError(NSError(domain: "BundleScheme", code: 404))
            return
        }
        var filePath = components.path
        if filePath.hasPrefix("/") { filePath = String(filePath.dropFirst()) }
        let fileURL = bundleURL.appendingPathComponent(filePath)
        guard let data = try? Data(contentsOf: fileURL) else {
            let body = "Not found: \(filePath)".data(using: .utf8)!
            let response = HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1",
                                           headerFields: ["Content-Type": "text/plain"])!
            urlSchemeTask.didReceive(response); urlSchemeTask.didReceive(body); urlSchemeTask.didFinish()
            return
        }
        let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1",
                                       headerFields: ["Content-Type": mimeType(for: fileURL),
                                                      "Content-Length": "\(data.count)",
                                                      "Cache-Control": "no-cache"])!
        urlSchemeTask.didReceive(response); urlSchemeTask.didReceive(data); urlSchemeTask.didFinish()
    }
    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}
    private func mimeType(for url: URL) -> String {
        switch url.pathExtension.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js":   return "application/javascript; charset=utf-8"
        case "css":  return "text/css; charset=utf-8"
        case "json": return "application/json"
        case "png":  return "image/png"
        case "jpg","jpeg": return "image/jpeg"
        case "svg":  return "image/svg+xml"
        case "woff": return "font/woff"
        case "woff2":return "font/woff2"
        case "ico":  return "image/x-icon"
        default:     return "application/octet-stream"
        }
    }
}

// MARK: - View Controller
class ViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, CLLocationManagerDelegate {

    private var webView: WKWebView!
    private let locationManager = CLLocationManager()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black

        let config = WKWebViewConfiguration()

        // ── Media / Camera / Microphone ───────────────────────────────────
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        // ── Geolocation ───────────────────────────────────────────────────
        let prefs = WKWebpagePreferences()
        prefs.allowsContentJavaScript = true
        config.defaultWebpagePreferences = prefs

        // ── Custom scheme ─────────────────────────────────────────────────
        config.setURLSchemeHandler(BundleSchemeHandler(), forURLScheme: "loupe")

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self          // required for permission dialogs
        webView.scrollView.bounces = false
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])

        locationManager.delegate = self

        let startURL = URL(string: "loupe://app/dist/index.html")!
        webView.load(URLRequest(url: startURL))
    }

    // MARK: - WKUIDelegate (iOS 15+) — Camera / Microphone native prompts
    @available(iOS 15.0, *)
    func webView(_ webView: WKWebView,
                 requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo,
                 type: WKMediaCaptureType,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        // Show native iOS camera/microphone permission dialog then allow
        decisionHandler(.grant)
    }

    // MARK: - WKUIDelegate — Geolocation native prompt
    func webView(_ webView: WKWebView,
                 requestGeolocationPermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        locationManager.requestWhenInUseAuthorization()
        decisionHandler(.grant)
    }

    // MARK: - WKNavigationDelegate
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Inject iOS detection so JS can know it's inside a native app
        let js = """
            window.__LOUPE_NATIVE__ = true;
            window.__LOUPE_PLATFORM__ = 'ios';
        """
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        showError("Load failed: \(error.localizedDescription)")
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        showError("Nav failed: \(error.localizedDescription)")
    }

    // MARK: - CLLocationManagerDelegate
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        // Trigger geolocation refresh in web view after permission granted
        if manager.authorizationStatus == .authorizedWhenInUse || manager.authorizationStatus == .authorizedAlways {
            webView.evaluateJavaScript("window.dispatchEvent(new Event('loupe-location-ready'))", completionHandler: nil)
        }
    }

    private func showError(_ msg: String) {
        let lbl = UILabel()
        lbl.text = msg; lbl.textColor = .red; lbl.numberOfLines = 0
        lbl.textAlignment = .center
        lbl.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
        lbl.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(lbl)
        NSLayoutConstraint.activate([
            lbl.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            lbl.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            lbl.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            lbl.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
        ])
    }

    override var prefersStatusBarHidden: Bool { false }
    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
}
