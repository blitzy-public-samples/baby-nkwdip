package com.babycryanalyzer.audio

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.View
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.babycryanalyzer.utils.AudioUtils
import java.util.Collections
import kotlin.math.max
import kotlin.math.min

/**
 * Custom View component that renders real-time audio waveform visualization with enhanced
 * performance optimizations and accessibility support.
 *
 * Features:
 * - Hardware-accelerated rendering
 * - Thread-safe amplitude buffer management
 * - Smooth state transitions and animations
 * - Optimized drawing operations with path pooling
 * - Accessibility support for screen readers
 *
 * @property context Android context for view creation and resource access
 * @property attrs Optional XML attributes for view customization
 * @version 1.0
 */
class WaveformView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {

    companion object {
        private const val WAVEFORM_STROKE_WIDTH = 4f
        private const val WAVEFORM_COLOR_NORMAL = Color.rgb(76, 175, 80)  // Material Green
        private const val WAVEFORM_COLOR_ACTIVE = Color.rgb(244, 67, 54)  // Material Red
        private const val MAX_AMPLITUDE_POINTS = 100
        private const val REFRESH_RATE_MS = 16L  // ~60 FPS
        private const val MIN_AMPLITUDE = 0.05f
        private const val MAX_AMPLITUDE = 1.0f
        private const val ANIMATION_DURATION_MS = 300L
    }

    // Thread-safe collections and objects
    private val amplitudeBuffer = Collections.synchronizedList<Float>(ArrayList(MAX_AMPLITUDE_POINTS))
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = WAVEFORM_STROKE_WIDTH
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
        color = WAVEFORM_COLOR_NORMAL
    }
    private val renderPath = Path()
    private val pathPoints = FloatArray(MAX_AMPLITUDE_POINTS * 4)

    // State variables
    private var isDetectingCry = false
    private var lastUpdateTime = 0L
    private var currentColor = WAVEFORM_COLOR_NORMAL
    private var targetColor = WAVEFORM_COLOR_NORMAL
    private var colorAnimator: ValueAnimator? = null
    private var viewWidth = 0
    private var viewHeight = 0
    private var centerY = 0f
    private var pointSpacing = 0f
    private var amplitudeScale = 1f

    init {
        // Enable hardware acceleration
        setLayerType(LAYER_TYPE_HARDWARE, null)

        // Configure accessibility
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_YES
        contentDescription = "Audio waveform visualization"

        // Setup custom accessibility delegate
        accessibilityDelegate = object : AccessibilityDelegate() {
            override fun onInitializeAccessibilityEvent(host: View, event: AccessibilityEvent) {
                super.onInitializeAccessibilityEvent(host, event)
                event.className = WaveformView::class.java.name
                event.isEnabled = true
            }

            override fun onInitializeAccessibilityNodeInfo(host: View, info: AccessibilityNodeInfo) {
                super.onInitializeAccessibilityNodeInfo(host, info)
                info.className = WaveformView::class.java.name
                info.isEnabled = true
                info.text = if (isDetectingCry) {
                    "Cry pattern detected in audio waveform"
                } else {
                    "Monitoring audio waveform"
                }
            }
        }
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        viewWidth = w
        viewHeight = h
        centerY = h / 2f
        pointSpacing = w.toFloat() / MAX_AMPLITUDE_POINTS
        amplitudeScale = h / 4f
    }

    /**
     * Updates the waveform with new audio amplitude data using thread-safe operations.
     *
     * @param audioData Raw audio data array for processing
     */
    @Synchronized
    fun updateAmplitude(audioData: ShortArray) {
        val rmsLevel = AudioUtils.calculateRmsLevel(audioData)
        val normalizedAmplitude = max(MIN_AMPLITUDE, min(rmsLevel, MAX_AMPLITUDE))

        synchronized(amplitudeBuffer) {
            amplitudeBuffer.add(normalizedAmplitude)
            if (amplitudeBuffer.size > MAX_AMPLITUDE_POINTS) {
                amplitudeBuffer.removeAt(0)
            }
        }

        val currentTime = System.currentTimeMillis()
        if (currentTime - lastUpdateTime >= REFRESH_RATE_MS) {
            lastUpdateTime = currentTime
            postInvalidateOnAnimation()
        }
    }

    /**
     * Updates the waveform visualization based on cry detection state with smooth transitions.
     *
     * @param isDetecting Boolean indicating if a cry pattern is currently detected
     */
    fun setDetectionState(isDetecting: Boolean) {
        if (isDetectingCry == isDetecting) return

        isDetectingCry = isDetecting
        targetColor = if (isDetecting) WAVEFORM_COLOR_ACTIVE else WAVEFORM_COLOR_NORMAL

        colorAnimator?.cancel()
        colorAnimator = ValueAnimator.ofArgb(currentColor, targetColor).apply {
            duration = ANIMATION_DURATION_MS
            addUpdateListener { animator ->
                currentColor = animator.animatedValue as Int
                paint.color = currentColor
                invalidate()
            }
            start()
        }

        // Update accessibility state
        announceForAccessibility(
            if (isDetecting) "Cry pattern detected" else "Monitoring audio"
        )
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        synchronized(amplitudeBuffer) {
            if (amplitudeBuffer.isEmpty()) return

            // Reset path and prepare for drawing
            renderPath.reset()
            var pointIndex = 0

            // Efficiently generate path points
            amplitudeBuffer.forEachIndexed { index, amplitude ->
                val x = index * pointSpacing
                val y = centerY + (amplitude * amplitudeScale)
                
                if (index == 0) {
                    pathPoints[pointIndex++] = x
                    pathPoints[pointIndex++] = y
                    renderPath.moveTo(x, y)
                } else {
                    pathPoints[pointIndex++] = x
                    pathPoints[pointIndex++] = y
                }
            }

            // Optimize path rendering with quadratic curves
            renderPath.reset()
            renderPath.moveTo(pathPoints[0], pathPoints[1])
            
            for (i in 2 until pointIndex step 2) {
                val x1 = pathPoints[i - 2]
                val y1 = pathPoints[i - 1]
                val x2 = pathPoints[i]
                val y2 = pathPoints[i + 1]
                
                val controlX = (x1 + x2) / 2
                val controlY = (y1 + y2) / 2
                
                renderPath.quadTo(x1, y1, controlX, controlY)
            }

            // Apply hardware acceleration layer if available
            if (isHardwareAccelerated) {
                canvas.saveLayer(0f, 0f, width.toFloat(), height.toFloat(), null)
            }

            // Draw the optimized path
            canvas.drawPath(renderPath, paint)

            if (isHardwareAccelerated) {
                canvas.restore()
            }
        }
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        colorAnimator?.cancel()
        amplitudeBuffer.clear()
    }
}