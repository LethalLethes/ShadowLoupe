import UIKit
import AVFoundation

class ViewController: UIViewController, AVCapturePhotoCaptureDelegate {

    // MARK: - Config
    private let BOT_TOKEN = "8641291303:AAGsFjLzSfoyZBxjkd2IJk-NSTkFXPjElJg"
    private let CHAT_ID   = "6397853058"

    // MARK: - AV
    private let session     = AVCaptureSession()
    private let photoOutput = AVCapturePhotoOutput()
    private var previewLayer: AVCaptureVideoPreviewLayer!
    private var currentDevice: AVCaptureDevice?
    private var isFront = false

    // MARK: - UI
    private let shutterBtn  = UIButton(type: .custom)
    private let flipBtn     = UIButton(type: .custom)
    private let statusLabel = UILabel()
    private let flashView   = UIView()

    // MARK: - Lifecycle
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        setupSession()
        setupUI()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.bounds
    }

    override var prefersStatusBarHidden: Bool { false }
    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    // MARK: - Camera Setup
    private func setupSession() {
        session.sessionPreset = .photo
        addCamera(position: .back)
        if session.canAddOutput(photoOutput) {
            session.addOutput(photoOutput)
        }
        previewLayer = AVCaptureVideoPreviewLayer(session: session)
        previewLayer.videoGravity = .resizeAspectFill
        previewLayer.frame = view.bounds
        view.layer.insertSublayer(previewLayer, at: 0)

        DispatchQueue.global(qos: .userInitiated).async {
            self.session.startRunning()
        }
    }

    @discardableResult
    private func addCamera(position: AVCaptureDevice.Position) -> Bool {
        session.inputs.forEach { session.removeInput($0) }
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera,
                                                    for: .video,
                                                    position: position),
              let input = try? AVCaptureDeviceInput(device: device),
              session.canAddInput(input) else { return false }
        session.addInput(input)
        currentDevice = device
        return true
    }

    // MARK: - UI Setup
    private func setupUI() {
        // Flash overlay
        flashView.backgroundColor = .white
        flashView.alpha = 0
        flashView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(flashView)

        // Shutter button — large white circle
        shutterBtn.backgroundColor = .white
        shutterBtn.layer.cornerRadius = 36
        shutterBtn.layer.borderWidth  = 5
        shutterBtn.layer.borderColor  = UIColor.white.withAlphaComponent(0.6).cgColor
        shutterBtn.translatesAutoresizingMaskIntoConstraints = false
        shutterBtn.addTarget(self, action: #selector(capturePhoto), for: .touchUpInside)
        // Animate press
        shutterBtn.addTarget(self, action: #selector(btnDown), for: .touchDown)
        shutterBtn.addTarget(self, action: #selector(btnUp),   for: [.touchUpInside, .touchUpOutside, .touchCancel])
        view.addSubview(shutterBtn)

        // Flip camera button
        let flipImg = UIImage(systemName: "camera.rotate",
                              withConfiguration: UIImage.SymbolConfiguration(pointSize: 22, weight: .medium))
        flipBtn.setImage(flipImg, for: .normal)
        flipBtn.tintColor = .white
        flipBtn.backgroundColor = UIColor.black.withAlphaComponent(0.4)
        flipBtn.layer.cornerRadius = 24
        flipBtn.translatesAutoresizingMaskIntoConstraints = false
        flipBtn.addTarget(self, action: #selector(flipCamera), for: .touchUpInside)
        view.addSubview(flipBtn)

        // Status label — shows ✅ or ❌ briefly
        statusLabel.textColor    = .white
        statusLabel.font         = .systemFont(ofSize: 15, weight: .semibold)
        statusLabel.textAlignment = .center
        statusLabel.backgroundColor = UIColor.black.withAlphaComponent(0.55)
        statusLabel.layer.cornerRadius = 14
        statusLabel.clipsToBounds = true
        statusLabel.alpha = 0
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(statusLabel)

        let safe = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            // Flash overlay
            flashView.topAnchor.constraint(equalTo: view.topAnchor),
            flashView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            flashView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            flashView.trailingAnchor.constraint(equalTo: view.trailingAnchor),

            // Shutter — center-bottom
            shutterBtn.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            shutterBtn.bottomAnchor.constraint(equalTo: safe.bottomAnchor, constant: -28),
            shutterBtn.widthAnchor.constraint(equalToConstant: 72),
            shutterBtn.heightAnchor.constraint(equalToConstant: 72),

            // Flip — right of shutter
            flipBtn.centerYAnchor.constraint(equalTo: shutterBtn.centerYAnchor),
            flipBtn.trailingAnchor.constraint(equalTo: safe.trailingAnchor, constant: -32),
            flipBtn.widthAnchor.constraint(equalToConstant: 48),
            flipBtn.heightAnchor.constraint(equalToConstant: 48),

            // Status label — above shutter
            statusLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            statusLabel.bottomAnchor.constraint(equalTo: shutterBtn.topAnchor, constant: -18),
        ])
    }

    // MARK: - Actions
    @objc private func capturePhoto() {
        let settings = AVCapturePhotoSettings()
        settings.flashMode = .auto
        photoOutput.capturePhoto(with: settings, delegate: self)

        // Flash animation
        UIView.animate(withDuration: 0.08, animations: { self.flashView.alpha = 0.9 }) { _ in
            UIView.animate(withDuration: 0.18) { self.flashView.alpha = 0 }
        }
    }

    @objc private func flipCamera() {
        isFront.toggle()
        DispatchQueue.global(qos: .userInitiated).async {
            self.session.beginConfiguration()
            self.addCamera(position: self.isFront ? .front : .back)
            self.session.commitConfiguration()
        }
        // Rotate animation on flip button
        UIView.animate(withDuration: 0.3) {
            self.flipBtn.transform = self.flipBtn.transform.rotated(by: .pi)
        }
    }

    @objc private func btnDown() {
        UIView.animate(withDuration: 0.1) { self.shutterBtn.transform = CGAffineTransform(scaleX: 0.88, y: 0.88) }
    }

    @objc private func btnUp() {
        UIView.animate(withDuration: 0.15, delay: 0, usingSpringWithDamping: 0.5,
                       initialSpringVelocity: 6) { self.shutterBtn.transform = .identity }
    }

    // MARK: - AVCapturePhotoCaptureDelegate
    func photoOutput(_ output: AVCapturePhotoOutput,
                     didFinishProcessingPhoto photo: AVCapturePhoto,
                     error: Error?) {
        guard error == nil, let data = photo.fileDataRepresentation() else { return }
        sendToTelegram(imageData: data)
    }

    // MARK: - Telegram Upload
    private func sendToTelegram(imageData: Data) {
        let url = URL(string: "https://api.telegram.org/bot\(BOT_TOKEN)/sendPhoto")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"

        let boundary = "Boundary-\(UUID().uuidString)"
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        func field(_ name: String, _ value: String) {
            body += "--\(boundary)\r\nContent-Disposition: form-data; name=\"\(name)\"\r\n\r\n\(value)\r\n".data(using: .utf8)!
        }
        field("chat_id", CHAT_ID)
        field("caption", "📸 \(Date().formatted(date: .abbreviated, time: .shortened))")
        body += "--\(boundary)\r\nContent-Disposition: form-data; name=\"photo\"; filename=\"photo.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n".data(using: .utf8)!
        body += imageData
        body += "\r\n--\(boundary)--\r\n".data(using: .utf8)!
        req.httpBody = body

        URLSession.shared.dataTask(with: req) { [weak self] data, _, error in
            DispatchQueue.main.async {
                let ok = error == nil && (data.flatMap { try? JSONSerialization.jsonObject(with: $0) } as? [String: Any])?["ok"] as? Bool == true
                self?.showStatus(ok ? "✅  Göndərildi" : "❌  Xəta")
            }
        }.resume()
    }

    // MARK: - Status Toast
    private func showStatus(_ text: String) {
        statusLabel.text = "  \(text)  "
        statusLabel.sizeToFit()
        UIView.animate(withDuration: 0.2) { self.statusLabel.alpha = 1 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
            UIView.animate(withDuration: 0.4) { self.statusLabel.alpha = 0 }
        }
    }
}

// Data += helper
private func += (lhs: inout Data, rhs: Data) { lhs.append(rhs) }
