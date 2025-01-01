//
// WaveformView.swift
// BabyCryAnalyzer
//
// Custom UIView subclass for real-time audio waveform visualization
// UIKit: iOS 14.0+
// CoreGraphics: iOS 14.0+
// Accelerate: iOS 14.0+
//

import UIKit
import CoreGraphics
import Accelerate

// MARK: - Constants
private let kDefaultLineWidth: CGFloat = 2.0
private let kDefaultLineColor = UIColor.systemBlue
private let kMaxAmplitude: Float = 1.0
private let kUpdateInterval: TimeInterval = 0.05
private let kMaxBufferSize: Int = 8192
private let kMinRefreshRate: Int = 30
private let kMaxRefreshRate: Int = 60

// MARK: - WaveformView
@IBDesignable
public class WaveformView: UIView {
    
    // MARK: - Public Properties
    @IBInspectable public var lineWidth: CGFloat = kDefaultLineWidth {
        didSet { setNeedsDisplay() }
    }
    
    @IBInspectable public var lineColor: UIColor = kDefaultLineColor {
        didSet { setNeedsDisplay() }
    }
    
    public var isAccessibilityEnabled: Bool = true {
        didSet { updateAccessibility() }
    }
    
    // MARK: - Private Properties
    private var samples: [Float] = []
    private var displayLink: CADisplayLink?
    private var audioProcessor: AudioProcessor?
    private var sampleBuffer: CircularBuffer<Float>
    private var currentTheme: UIUserInterfaceStyle = .light
    private var scaleFactor: CGFloat = UIScreen.main.scale
    private let processingQueue = DispatchQueue(label: "com.babycryanalyzer.waveform.processing",
                                              qos: .userInteractive)
    
    // MARK: - Initialization
    override public init(frame: CGRect) {
        sampleBuffer = CircularBuffer(capacity: kMaxBufferSize)
        super.init(frame: frame)
        setupView()
    }
    
    required init?(coder: NSCoder) {
        sampleBuffer = CircularBuffer(capacity: kMaxBufferSize)
        super.init(coder: coder)
        setupView()
    }
    
    // MARK: - View Lifecycle
    public override func draw(_ rect: CGRect) {
        guard let context = UIGraphicsGetCurrentContext() else { return }
        
        // Configure drawing context
        context.setAllowsAntialiasing(true)
        context.setShouldAntialias(true)
        context.setLineCap(.round)
        context.setLineWidth(lineWidth)
        context.setStrokeColor(lineColor.cgColor)
        
        // Create waveform path
        let path = createWaveformPath()
        context.addPath(path)
        context.strokePath()
    }
    
    // MARK: - Public Methods
    public func updateWaveform(with samples: [Float]) {
        processingQueue.async { [weak self] in
            guard let self = self else { return }
            
            // Process samples in chunks for better performance
            let processedSamples = self.processSamples(samples)
            
            // Update buffer with new samples
            self.sampleBuffer.write(processedSamples)
            
            // Trigger redraw on main thread
            DispatchQueue.main.async {
                self.setNeedsDisplay()
                self.updateAccessibilityValue()
            }
        }
    }
    
    public func setTheme(_ style: UIUserInterfaceStyle) {
        currentTheme = style
        lineColor = style == .dark ? .systemBlue.withAlphaComponent(0.8) : .systemBlue
        backgroundColor = style == .dark ? .black : .white
        setNeedsDisplay()
    }
    
    // MARK: - Private Methods
    private func setupView() {
        // Layer configuration
        layer.drawsAsynchronously = true
        layer.shouldRasterize = true
        layer.rasterizationScale = scaleFactor
        
        // Configure display link
        let preferredFramesPerSecond = max(kMinRefreshRate,
                                         min(kMaxRefreshRate, Int(UIScreen.main.maximumFramesPerSecond)))
        displayLink = CADisplayLink(target: self, selector: #selector(displayLinkDidFire))
        displayLink?.preferredFramesPerSecond = preferredFramesPerSecond
        displayLink?.add(to: .main, forMode: .common)
        
        // Setup accessibility
        setupAccessibility()
        
        // Observe theme changes
        NotificationCenter.default.addObserver(self,
                                             selector: #selector(handleThemeChange),
                                             name: UIApplication.didBecomeActiveNotification,
                                             object: nil)
    }
    
    private func createWaveformPath() -> CGPath {
        let path = CGMutablePath()
        let width = bounds.width
        let height = bounds.height
        let centerY = height / 2
        
        // Get samples from buffer
        let samples = sampleBuffer.read()
        guard !samples.isEmpty else { return path }
        
        // Calculate points per sample
        let pointsPerSample = width / CGFloat(samples.count)
        
        // Start path
        path.move(to: CGPoint(x: 0, y: centerY))
        
        // Draw waveform
        for (index, sample) in samples.enumerated() {
            let x = CGFloat(index) * pointsPerSample
            let y = centerY + CGFloat(sample) * (height / 2)
            path.addLine(to: CGPoint(x: x, y: y))
        }
        
        return path
    }
    
    private func processSamples(_ samples: [Float]) -> [Float] {
        var processedSamples = samples
        
        // Normalize samples
        var normalizedSamples = [Float](repeating: 0.0, count: samples.count)
        vDSP_vabs(samples, 1, &normalizedSamples, 1, vDSP_Length(samples.count))
        vDSP_vsdiv(normalizedSamples, 1, [kMaxAmplitude], &normalizedSamples, 1, vDSP_Length(samples.count))
        
        // Apply smoothing
        var smoothedSamples = [Float](repeating: 0.0, count: samples.count)
        vDSP_vswsum(normalizedSamples, 1, &smoothedSamples, 1, vDSP_Length(samples.count), 3)
        
        processedSamples = smoothedSamples
        return processedSamples
    }
    
    private func setupAccessibility() {
        isAccessibilityElement = true
        accessibilityLabel = "Audio Waveform Visualization"
        accessibilityTraits = .updatesFrequently
    }
    
    private func updateAccessibilityValue() {
        guard isAccessibilityEnabled else { return }
        
        let averageAmplitude = samples.reduce(0, +) / Float(samples.count)
        let percentage = Int(averageAmplitude * 100)
        accessibilityValue = "Audio level \(percentage) percent"
    }
    
    @objc private func displayLinkDidFire() {
        setNeedsDisplay()
    }
    
    @objc private func handleThemeChange() {
        setTheme(traitCollection.userInterfaceStyle)
    }
    
    // MARK: - Cleanup
    deinit {
        displayLink?.invalidate()
        NotificationCenter.default.removeObserver(self)
    }
}

// MARK: - CircularBuffer
private class CircularBuffer<T> {
    private var buffer: [T]
    private var writeIndex = 0
    private let capacity: Int
    
    init(capacity: Int) {
        self.capacity = capacity
        self.buffer = []
        self.buffer.reserveCapacity(capacity)
    }
    
    func write(_ elements: [T]) {
        elements.forEach { element in
            if buffer.count < capacity {
                buffer.append(element)
            } else {
                buffer[writeIndex] = element
                writeIndex = (writeIndex + 1) % capacity
            }
        }
    }
    
    func read() -> [T] {
        return buffer
    }
}