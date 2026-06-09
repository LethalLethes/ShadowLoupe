import UIKit
import WebKit
import MobileCoreServices
import UniformTypeIdentifiers

// MARK: - Custom URL Scheme Handler
// Serves files from the app bundle via loupe://app/ scheme.
// This avoids all file:// protocol restrictions on modern iOS.
class BundleSchemeHandler: NSObject, WKURLSchemeHandler {

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            urlSchemeTask.didFailWithError(NSError(domain: "BundleScheme", code: 404))
            return
        }

        // Map loupe://app/dist/... → <Bundle>/dist/...
        var filePath = components.path
        if filePath.hasPrefix("/") { filePath = String(filePath.dropFirst()) }

        guard let bundleURL = Bundle.main.resourceURL else {
            urlSchemeTask.didFailWithError(NSError(domain: "BundleScheme", code: 500))
            return
        }

        let fileURL = bundleURL.appendingPathComponent(filePath)

        guard let data = try? Data(contentsOf: fileURL) else {
            // 404: file not found
            let body = "Not found: \(filePath)".data(using: .utf8)!
            let response = HTTPURLResponse(
                url: url, statusCode: 404,
                httpVersion: "HTTP/1.1",
                headerFields: ["Content-Type": "text/plain"]
            )!
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(body)
            urlSchemeTask.didFinish()
            return
        }

        let mimeType = mimeType(for: fileURL)
        let response = HTTPURLResponse(
            url: url, statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: [
                "Content-Type": mimeType,
                "Content-Length": "\(data.count)",
                "Cache-Control": "no-cache",
            ]
        )!

        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    private func mimeType(for url: URL) -> String {
        let ext = url.pathExtension.lowercased()
        switch ext {
        case "html": return "text/html; charset=utf-8"
        case "js":   return "application/javascript; charset=utf-8"
        case "css":  return "text/css; charset=utf-8"
        case "json": return "application/json"
        case "png":  return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "svg":  return "image/svg+xml"
        case "woff": return "font/woff"
        case "woff2": return "font/woff2"
        case "ttf":  return "font/ttf"
        case "ico":  return "image/x-icon"
        default:     return "application/octet-stream"
        }
    }
}

// MARK: - View Controller
class ViewController: UIViewController, WKNavigationDelegate {

    private var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black

        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.setURLSchemeHandler(BundleSchemeHandler(), forURLScheme: "loupe")

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
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

        // Load via custom scheme — no file:// restrictions
        let startURL = URL(string: "loupe://app/dist/index.html")!
        webView.load(URLRequest(url: startURL))
    }

    // MARK: - WKNavigationDelegate
    func webView(_ webView: WKWebView,
                 didFailProvisionalNavigation navigation: WKNavigation!,
                 withError error: Error) {
        showError("Load failed: \(error.localizedDescription)")
    }

    func webView(_ webView: WKWebView,
                 didFail navigation: WKNavigation!,
                 withError error: Error) {
        showError("Nav failed: \(error.localizedDescription)")
    }

    private func showError(_ msg: String) {
        let lbl = UILabel()
        lbl.text = msg
        lbl.textColor = .red
        lbl.numberOfLines = 0
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
