package com.babycryanalyzer.audio

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * React Native package implementation for the Baby Cry Analyzer's audio capture functionality.
 * Provides native module registration with enhanced error handling and lifecycle management.
 *
 * @version 1.0
 */
@Singleton
class AudioCapturePackage @Inject constructor(
    @ApplicationContext private val applicationContext: ReactApplicationContext,
    private val audioProcessor: AudioProcessor,
    private val audioRecorderService: AudioRecorderService
) : ReactPackage {

    companion object {
        private const val TAG = "AudioCapturePackage"
        private const val MODULE_REGISTRATION_ERROR = "Failed to register AudioCaptureModule"
    }

    /**
     * Creates and returns a list of native modules to be registered with React Native.
     * Implements comprehensive error handling and lifecycle management.
     *
     * @param reactContext The React Native application context
     * @return List containing the properly initialized AudioCaptureModule
     * @throws IllegalStateException if module initialization fails
     */
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        try {
            // Initialize module with dependency injection
            val audioCaptureModule = AudioCaptureModule(
                reactContext = reactContext,
                audioProcessor = audioProcessor,
                audioRecorderService = audioRecorderService
            )

            // Return immutable list containing the module
            return listOf(audioCaptureModule)

        } catch (e: Exception) {
            // Log error and rethrow with context
            android.util.Log.e(TAG, "$MODULE_REGISTRATION_ERROR: ${e.message}")
            throw IllegalStateException(MODULE_REGISTRATION_ERROR, e)
        }
    }

    /**
     * Creates and returns a list of view managers.
     * Currently returns an empty list as no view managers are needed for audio capture.
     *
     * @param reactContext The React Native application context
     * @return Empty list of view managers
     */
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}